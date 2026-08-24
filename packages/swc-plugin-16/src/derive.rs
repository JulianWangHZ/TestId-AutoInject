//! Port of `src/id/derive.ts`. Screen slug from file path + layered base id.

use crate::element_type::element_name_to_type;
use crate::slugify::{slugify, slugify_unicode};

/// Remove a trailing `.ext` (matching the TS regex `\.[^/.]+$`).
fn strip_ext(path: &str) -> &str {
    if let Some(dot) = path.rfind('.') {
        let ext = &path[dot + 1..];
        if !ext.is_empty() && !ext.contains(|c| c == '/' || c == '\\' || c == '.') {
            return &path[..dot];
        }
    }
    path
}

/// Default framework directories dropped from the screen slug.
pub const DEFAULT_STRIP_DIRS: &[&str] = &["src", "app", "screens", "components", "pages"];

pub fn derive_screen(relative_path: &str, strip_dirs: &[String]) -> String {
    let no_ext = strip_ext(relative_path);
    let mut parts: Vec<&str> = no_ext
        .split(|c| c == '/' || c == '\\')
        .filter(|s| !s.is_empty())
        .collect();

    while parts.len() > 1 && strip_dirs.iter().any(|d| d == parts[0]) {
        parts.remove(0);
    }

    // Drop conventional filename segments carrying no screen meaning.
    if parts.len() > 1 {
        let last = parts[parts.len() - 1].to_lowercase();
        if matches!(last.as_str(), "index" | "page" | "layout" | "route") {
            parts.pop();
        }
    }

    let joined = parts
        .iter()
        .map(|p| slugify(p))
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if joined.is_empty() {
        "screen".to_string()
    } else {
        joined
    }
}

pub struct IdInput<'a> {
    pub screen: &'a str,
    pub element_name: &'a str,
    pub label: Option<&'a str>,
    pub handler_signal: Option<&'a str>,
    /// Keep a non-ASCII label verbatim as a readable fallback. Default true.
    pub cjk_fallback: bool,
}

/// Build `{screen}-{name}-{type}`. `name` = first meaningful of:
/// English label -> handler intent -> CJK label -> element name.
pub fn derive_base_id(input: &IdInput) -> String {
    let type_seg = element_name_to_type(input.element_name);
    let ascii_label = input.label.map(slugify).unwrap_or_default();
    let handler = input.handler_signal.map(slugify).unwrap_or_default();
    let cjk_label = if input.cjk_fallback {
        input.label.map(slugify_unicode).unwrap_or_default()
    } else {
        String::new()
    };
    let last_seg = input.element_name.split('.').next_back().unwrap_or(input.element_name);
    let element_slug = slugify(last_seg);

    let name_part = [ascii_label, handler, cjk_label, element_slug]
        .into_iter()
        .find(|s| !s.is_empty())
        .unwrap_or_default();

    [input.screen.to_string(), name_part, type_seg]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dirs() -> Vec<String> {
        DEFAULT_STRIP_DIRS.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn screen_strips_dirs_and_index() {
        assert_eq!(derive_screen("app/login/index.tsx", &dirs()), "login");
        assert_eq!(derive_screen("src/screens/EventDetail.tsx", &dirs()), "event-detail");
        assert_eq!(derive_screen("components/PhoneField.tsx", &dirs()), "phone-field");
        assert_eq!(derive_screen("unknown", &dirs()), "unknown");
        assert_eq!(derive_screen("", &dirs()), "screen");
    }

    fn input<'a>(
        screen: &'a str,
        el: &'a str,
        label: Option<&'a str>,
        handler: Option<&'a str>,
        cjk: bool,
    ) -> IdInput<'a> {
        IdInput { screen, element_name: el, label, handler_signal: handler, cjk_fallback: cjk }
    }

    #[test]
    fn base_id_priority() {
        assert_eq!(derive_base_id(&input("login", "Pressable", Some("Submit"), None, true)), "login-submit-button");
        assert_eq!(derive_base_id(&input("login", "TextInput", None, None, true)), "login-text-input-input");
        // English label beats handler
        assert_eq!(derive_base_id(&input("home", "button", Some("Search"), Some("submit"), true)), "home-search-button");
        // handler beats CJK label
        assert_eq!(derive_base_id(&input("home", "button", Some("今天"), Some("today"), true)), "home-today-button");
        // CJK kept when no English signal
        assert_eq!(derive_base_id(&input("login", "button", Some("登入"), None, true)), "login-登入-button");
        // cjkFallback=false reverts to element name
        assert_eq!(derive_base_id(&input("login", "button", Some("登入"), None, false)), "login-button-button");
    }
}

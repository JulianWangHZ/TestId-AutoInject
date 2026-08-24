//! Port of `src/id/element-type.ts`. Maps a JSX element name to a short "type"
//! segment: the last part of `{screen}-{name}-{type}`.

use crate::slugify::slugify;

/// Whitelisted element name -> type. Covers RN primitives + HTML host elements.
fn type_map(seg: &str) -> Option<&'static str> {
    Some(match seg {
        "Button" | "Pressable" | "TouchableOpacity" | "TouchableHighlight"
        | "TouchableWithoutFeedback" | "button" => "button",
        "TextInput" | "Input" | "input" | "textarea" => "input",
        "Select" | "select" => "select",
        "Switch" => "switch",
        "Checkbox" => "checkbox",
        "Radio" => "radio",
        "Text" => "text",
        "Image" | "img" => "image",
        "a" => "link",
        "form" => "form",
        "label" => "label",
        _ => return None,
    })
}

/// Suffix heuristics for unknown names, checked left-to-right like the TS array.
fn suffix_rule(last: &str) -> Option<&'static str> {
    if last.ends_with("Button") {
        Some("button")
    } else if last.ends_with("Input") {
        Some("input")
    } else if last.ends_with("Field") {
        Some("field")
    } else if last.ends_with("Select") {
        Some("select")
    } else if last.ends_with("Checkbox") {
        Some("checkbox")
    } else if last.ends_with("Switch") {
        Some("switch")
    } else if last.ends_with("Link") {
        Some("link")
    } else {
        None
    }
}

pub fn element_name_to_type(element_name: &str) -> String {
    let segments: Vec<&str> = element_name.split('.').collect();
    // Dotted components (`Radio.Root`): the family segment carries the meaning,
    // so check every segment against the map first.
    for seg in &segments {
        if let Some(t) = type_map(seg) {
            return t.to_string();
        }
    }
    let last = *segments.last().unwrap_or(&element_name);
    if let Some(t) = suffix_rule(last) {
        return t.to_string();
    }
    let s = slugify(last);
    if s.is_empty() {
        "element".to_string()
    } else {
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_map_suffix_fallback() {
        assert_eq!(element_name_to_type("Pressable"), "button");
        assert_eq!(element_name_to_type("TextInput"), "input");
        assert_eq!(element_name_to_type("PhoneField"), "field");
        assert_eq!(element_name_to_type("Radio.Root"), "radio");
        assert_eq!(element_name_to_type("WeirdThing"), "weird-thing");
    }
}

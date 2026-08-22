//! Port of `src/id/slugify.ts`. Behaviour must match the Babel engine exactly.
//!
//! - `slugify`: ASCII-only. camelCase boundaries become dashes; non-alphanumeric
//!   runs collapse to a single dash; trimmed and lowercased. CJK collapses away.
//! - `slugify_unicode`: same, but keeps Unicode letters/digits (CJK, accented)
//!   as a readable fallback.

fn slug_impl(input: &str, unicode: bool) -> String {
    // 1. Insert a dash at camelCase / PascalCase boundaries: `submitButton` ->
    //    `submit-Button`. Only ASCII case transitions, matching the TS regex
    //    `([a-z0-9])([A-Z])`.
    let chars: Vec<char> = input.chars().collect();
    let mut spaced = String::with_capacity(input.len() + 8);
    for (i, &c) in chars.iter().enumerate() {
        if i > 0 {
            let prev = chars[i - 1];
            if (prev.is_ascii_lowercase() || prev.is_ascii_digit()) && c.is_ascii_uppercase() {
                spaced.push('-');
            }
        }
        spaced.push(c);
    }

    // 2. Split on every disallowed character (which also collapses runs and
    //    trims leading/trailing separators), lowercase each part, join by dash.
    spaced
        .split(|c: char| {
            let keep = if unicode {
                c.is_alphanumeric()
            } else {
                c.is_ascii_alphanumeric()
            };
            !keep
        })
        .filter(|s| !s.is_empty())
        .map(|s| s.to_lowercase())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn slugify(input: &str) -> String {
    slug_impl(input, false)
}

pub fn slugify_unicode(input: &str) -> String {
    slug_impl(input, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_slugify() {
        assert_eq!(slugify("submitButton"), "submit-button");
        assert_eq!(slugify("Log In Now!"), "log-in-now");
        assert_eq!(slugify("  spaced  "), "spaced");
        assert_eq!(slugify("今天"), "");
        assert_eq!(slugify("登入 Login"), "login");
    }

    #[test]
    fn unicode_slugify() {
        assert_eq!(slugify_unicode("今天"), "今天");
        assert_eq!(slugify_unicode("選擇日期"), "選擇日期");
        assert_eq!(slugify_unicode("submitButton"), "submit-button");
        assert_eq!(slugify_unicode("登入 Login"), "登入-login");
    }
}

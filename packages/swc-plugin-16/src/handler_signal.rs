//! Port of `src/id/handler-signal.ts`, adapted to the SWC AST.
//!
//! Mine an English intent slug from an element's event handlers, so non-Latin
//! UIs (CJK) still get a stable, meaningful id from the handler names/args that
//! developers already write in English.

use swc_core::ecma::ast::{
    ArrowExpr, CallExpr, Callee, Expr, ExprOrSpread, FnExpr, JSXAttrName, JSXAttrOrSpread,
    JSXAttrValue, JSXExpr, JSXOpeningElement, Lit, MemberProp, OptCall,
};
use swc_core::ecma::visit::{Visit, VisitWith};

/// Event handler props, in priority order.
const HANDLER_ATTRS: &[&str] = &["onClick", "onPress", "onChange", "onSubmit", "onValueChange"];

/// Slugs too generic to make a useful id.
const STOPWORDS: &[&str] = &[
    "fn", "cb", "callback", "handler", "handle", "on", "e", "ev", "evt", "event",
];

/// Strip the conventional `handle`/`on` prefix: `handleSubmit` -> `Submit`.
fn strip_handler_prefix(name: &str) -> String {
    let after = name
        .strip_prefix("handle")
        .or_else(|| name.strip_prefix("on"))
        .filter(|rest| {
            rest.chars()
                .next()
                .map_or(false, |c| c.is_ascii_uppercase() || c == '_')
        });
    let stripped = match after {
        Some(rest) => rest.trim_start_matches('_').to_string(),
        None => name.to_string(),
    };
    if stripped.is_empty() {
        name.to_string()
    } else {
        stripped
    }
}

/// Reject empty, single-letter, or stopword slugs.
fn meaningful(slug: String) -> Option<String> {
    if slug.chars().count() < 2 {
        return None;
    }
    let compact = slug.replace('-', "");
    if STOPWORDS.contains(&compact.as_str()) {
        return None;
    }
    Some(slug)
}

/// Slug from a call's args (string literal with a letter) or its callee name.
fn signal_from_call(args: &[ExprOrSpread], callee: Option<&Expr>) -> Option<String> {
    for arg in args {
        if arg.spread.is_some() {
            continue;
        }
        if let Expr::Lit(Lit::Str(s)) = &*arg.expr {
            let sv = s.value.to_string_lossy();
            if sv.chars().any(|c| c.is_ascii_alphabetic()) {
                if let Some(m) = meaningful(crate::slugify::slugify(&sv)) {
                    return Some(m);
                }
            }
        }
    }
    match callee? {
        Expr::Ident(id) => meaningful(crate::slugify::slugify(&strip_handler_prefix(&id.sym))),
        Expr::Member(m) => {
            if let Expr::Ident(obj) = &*m.obj {
                if let Some(x) = meaningful(crate::slugify::slugify(&obj.sym)) {
                    return Some(x);
                }
            }
            if let MemberProp::Ident(prop) = &m.prop {
                return meaningful(crate::slugify::slugify(&strip_handler_prefix(&prop.sym)));
            }
            None
        }
        _ => None,
    }
}

fn from_call_expr(call: &CallExpr) -> Option<String> {
    let callee = match &call.callee {
        Callee::Expr(e) => Some(&**e),
        _ => None,
    };
    signal_from_call(&call.args, callee)
}

fn from_opt_call(call: &OptCall) -> Option<String> {
    signal_from_call(&call.args, Some(&*call.callee))
}

/// Depth-first (source order) finder for the first meaningful call in a body.
struct CallFinder {
    result: Option<String>,
}

impl Visit for CallFinder {
    fn visit_call_expr(&mut self, n: &CallExpr) {
        if self.result.is_some() {
            return;
        }
        if let Some(s) = from_call_expr(n) {
            self.result = Some(s);
            return;
        }
        n.visit_children_with(self);
    }

    fn visit_opt_call(&mut self, n: &OptCall) {
        if self.result.is_some() {
            return;
        }
        if let Some(s) = from_opt_call(n) {
            self.result = Some(s);
            return;
        }
        n.visit_children_with(self);
    }
}

fn first_signal_in_arrow(arrow: &ArrowExpr) -> Option<String> {
    let mut f = CallFinder { result: None };
    arrow.body.visit_with(&mut f);
    f.result
}

fn first_signal_in_fn(func: &FnExpr) -> Option<String> {
    let mut f = CallFinder { result: None };
    if let Some(body) = &func.function.body {
        body.visit_with(&mut f);
    }
    f.result
}

fn from_expression(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Ident(id) => {
            meaningful(crate::slugify::slugify(&strip_handler_prefix(&id.sym)))
        }
        Expr::Member(m) => {
            if let Expr::Ident(obj) = &*m.obj {
                if let Some(x) = meaningful(crate::slugify::slugify(&obj.sym)) {
                    return Some(x);
                }
            }
            if let MemberProp::Ident(prop) = &m.prop {
                return meaningful(crate::slugify::slugify(&strip_handler_prefix(&prop.sym)));
            }
            None
        }
        Expr::Arrow(arrow) => first_signal_in_arrow(arrow),
        Expr::Fn(func) => first_signal_in_fn(func),
        _ => None,
    }
}

pub fn derive_handler_signal(open: &JSXOpeningElement) -> Option<String> {
    for key in HANDLER_ATTRS {
        for attr in &open.attrs {
            let JSXAttrOrSpread::JSXAttr(a) = attr else {
                continue;
            };
            let JSXAttrName::Ident(name) = &a.name else {
                continue;
            };
            if name.sym.as_ref() != *key {
                continue;
            }
            if let Some(JSXAttrValue::JSXExprContainer(c)) = &a.value {
                if let JSXExpr::Expr(expr) = &c.expr {
                    if let Some(s) = from_expression(expr) {
                        return Some(s);
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_prefix_cases() {
        assert_eq!(strip_handler_prefix("handleSubmit"), "Submit");
        assert_eq!(strip_handler_prefix("onClose"), "Close");
        assert_eq!(strip_handler_prefix("onlyText"), "onlyText"); // lookahead guard
        assert_eq!(strip_handler_prefix("on"), "on");
        assert_eq!(strip_handler_prefix("scrollNext"), "scrollNext");
    }

    #[test]
    fn meaningful_filters() {
        assert_eq!(meaningful("s".to_string()), None);
        assert_eq!(meaningful("fn".to_string()), None);
        assert_eq!(meaningful("today".to_string()), Some("today".to_string()));
    }
}

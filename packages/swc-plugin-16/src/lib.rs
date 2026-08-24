//! SWC plugin engine for testid-autoinject. Injects a stable
//! `data-testid` / `testID` onto interactive JSX elements at build time,
//! mirroring the Babel engine's id derivation. Works on Next.js 15+ (webpack &
//! Turbopack) without opting out of SWC.

// The plugin entry (and the visitor it drives) is wasm-only; native `cargo test`
// compiles the pure id modules to cross-check them against the Babel engine.
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code, unused_imports))]

mod derive;
mod element_type;
mod handler_signal;
mod slugify;

use std::collections::{HashMap, HashSet};

use serde::Deserialize;
use swc_core::common::DUMMY_SP;
use swc_core::ecma::ast::{
    Expr, IdentName, JSXAttr, JSXAttrName, JSXAttrOrSpread, JSXAttrValue, JSXElement,
    JSXElementChild, JSXElementName, JSXExpr, JSXMemberExpr, JSXObject, JSXOpeningElement, Lit,
    Program, Str,
};
use swc_core::ecma::visit::{VisitMut, VisitMutWith};
#[cfg(target_arch = "wasm32")]
use swc_core::plugin::metadata::TransformPluginMetadataContextKind;
#[cfg(target_arch = "wasm32")]
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

use crate::derive::{derive_base_id, derive_screen, IdInput, DEFAULT_STRIP_DIRS};
use crate::handler_signal::derive_handler_signal;

/// Interactive elements worth a stable selector (RN + web).
const DEFAULT_TARGETS: &[&str] = &[
    "Button",
    "Pressable",
    "TouchableOpacity",
    "TouchableHighlight",
    "TouchableWithoutFeedback",
    "TextInput",
    "Input",
    "Select",
    "Switch",
    "Checkbox",
    "Radio",
    "button",
    "a",
    "input",
    "textarea",
    "select",
];

/// Attributes, in priority order, carrying a human-meaningful label.
const LABEL_ATTRS: &[&str] = &[
    "accessibilityLabel",
    "aria-label",
    "label",
    "placeholder",
    "title",
    "name",
];

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct Config {
    platform: Option<String>,
    attribute: Option<String>,
    envs: Option<Vec<String>>,
    targets: Option<Vec<String>>,
    inject_all: bool,
    strip_dirs: Option<Vec<String>>,
    cjk_fallback: Option<bool>,
}

fn get_element_name(name: &JSXElementName) -> Option<String> {
    match name {
        JSXElementName::Ident(i) => Some(i.sym.to_string()),
        JSXElementName::JSXMemberExpr(m) => Some(jsx_member_to_string(m)),
        JSXElementName::JSXNamespacedName(_) => None, // namespaced -> skip
    }
}

fn jsx_member_to_string(m: &JSXMemberExpr) -> String {
    let mut parts = vec![m.prop.sym.to_string()];
    let mut obj = &m.obj;
    loop {
        match obj {
            JSXObject::JSXMemberExpr(inner) => {
                parts.push(inner.prop.sym.to_string());
                obj = &inner.obj;
            }
            JSXObject::Ident(i) => {
                parts.push(i.sym.to_string());
                break;
            }
        }
    }
    parts.reverse();
    parts.join(".")
}

fn attr_name_eq(name: &JSXAttrName, s: &str) -> bool {
    match name {
        JSXAttrName::Ident(i) => i.sym.as_ref() == s,
        JSXAttrName::JSXNamespacedName(n) => {
            format!("{}:{}", n.ns.sym, n.name.sym) == s
        }
    }
}

fn has_attr(open: &JSXOpeningElement, attr: &str) -> bool {
    open.attrs.iter().any(|a| {
        matches!(a, JSXAttrOrSpread::JSXAttr(x) if attr_name_eq(&x.name, attr))
    })
}

fn string_attr_value(a: &JSXAttr) -> Option<String> {
    match &a.value {
        Some(JSXAttrValue::Str(s)) => Some(s.value.to_string_lossy().into_owned()),
        Some(JSXAttrValue::JSXExprContainer(c)) => {
            if let JSXExpr::Expr(e) = &c.expr {
                match &**e {
                    Expr::Lit(Lit::Str(s)) => Some(s.value.to_string_lossy().into_owned()),
                    Expr::Tpl(t) if t.exprs.is_empty() => t
                        .quasis
                        .first()
                        .and_then(|q| q.cooked.as_ref().map(|c| c.to_string_lossy().into_owned())),
                    _ => None,
                }
            } else {
                None
            }
        }
        _ => None,
    }
}

fn find_label(open: &JSXOpeningElement, children: &[JSXElementChild]) -> Option<String> {
    for key in LABEL_ATTRS {
        for a in &open.attrs {
            if let JSXAttrOrSpread::JSXAttr(x) = a {
                if attr_name_eq(&x.name, key) {
                    if let Some(s) = string_attr_value(x) {
                        let t = s.trim();
                        if !t.is_empty() {
                            return Some(t.to_string());
                        }
                    }
                }
            }
        }
    }
    for c in children {
        if let JSXElementChild::JSXText(t) = c {
            let s = t.value.trim();
            if !s.is_empty() {
                return Some(s.to_string());
            }
        }
    }
    None
}

fn new_attr(name: &str, value: &str) -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::new(name.into(), DUMMY_SP)),
        value: Some(JSXAttrValue::Str(Str {
            span: DUMMY_SP,
            value: value.into(),
            raw: None,
        })),
    })
}

struct Injector {
    attribute: String,
    targets: Option<HashSet<String>>, // None = inject_all
    screen: String,
    cjk_fallback: bool,
    counts: HashMap<String, usize>,
}

impl VisitMut for Injector {
    fn visit_mut_jsx_element(&mut self, el: &mut JSXElement) {
        el.visit_mut_children_with(self);

        let name = match get_element_name(&el.opening.name) {
            Some(n) => n,
            None => return,
        };
        if has_attr(&el.opening, &self.attribute) {
            return; // manual value wins
        }
        if let Some(targets) = &self.targets {
            let last = name.rsplit('.').next().unwrap_or(&name);
            if !targets.contains(last) && !targets.contains(&name) {
                return;
            }
        }

        let label = find_label(&el.opening, &el.children);
        let handler = derive_handler_signal(&el.opening);
        let base = derive_base_id(&IdInput {
            screen: &self.screen,
            element_name: &name,
            label: label.as_deref(),
            handler_signal: handler.as_deref(),
            cjk_fallback: self.cjk_fallback,
        });

        let seen = *self.counts.get(&base).unwrap_or(&0);
        self.counts.insert(base.clone(), seen + 1);
        let id = if seen == 0 {
            base
        } else {
            format!("{}-{}", base, seen + 1)
        };

        el.opening.attrs.push(new_attr(&self.attribute, &id));
    }
}

#[cfg(target_arch = "wasm32")]
#[plugin_transform]
fn process(mut program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let config: Config = metadata
        .get_transform_plugin_config()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();

    // Env gating, matching the Babel engine (default: test + development only).
    let env = metadata
        .get_context(&TransformPluginMetadataContextKind::Env)
        .unwrap_or_default();
    let envs = config
        .envs
        .clone()
        .unwrap_or_else(|| vec!["test".to_string(), "development".to_string()]);
    if !envs.iter().any(|e| e == &env) {
        return program;
    }

    let attribute = config.attribute.clone().unwrap_or_else(|| {
        if config.platform.as_deref() == Some("native") {
            "testID".to_string()
        } else {
            "data-testid".to_string()
        }
    });

    let targets = if config.inject_all {
        None
    } else {
        let set: HashSet<String> = config
            .targets
            .clone()
            .unwrap_or_else(|| DEFAULT_TARGETS.iter().map(|s| s.to_string()).collect())
            .into_iter()
            .collect();
        Some(set)
    };

    let strip_dirs: Vec<String> = config
        .strip_dirs
        .clone()
        .unwrap_or_else(|| DEFAULT_STRIP_DIRS.iter().map(|s| s.to_string()).collect());

    let filename = metadata
        .get_context(&TransformPluginMetadataContextKind::Filename)
        .unwrap_or_default();
    let cwd = metadata
        .get_context(&TransformPluginMetadataContextKind::Cwd)
        .unwrap_or_default();
    let rel = filename.strip_prefix(&cwd).unwrap_or(&filename);
    let rel = rel.trim_start_matches(['/', '\\']);
    let screen = derive_screen(rel, &strip_dirs);

    let mut injector = Injector {
        attribute,
        targets,
        screen,
        cjk_fallback: config.cjk_fallback.unwrap_or(true),
        counts: HashMap::new(),
    };
    program.visit_mut_with(&mut injector);
    program
}

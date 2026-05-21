use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

static FC2_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?i)FC2[-_ ]?(?:PPV[-_ ]?)?(\d{4,10})$").unwrap());
static SITE_NUMERIC_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?i)(HEYZO)[-_ ]?(\d{2,10})$").unwrap());
static STANDARD_SUFFIX_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?i)([A-Z]{2,10})[-_ ]?(\d{2,6})([A-Z])$").unwrap()
});
static STANDARD_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?i)([A-Z]{2,10})[-_ ]?(\d{2,6})$").unwrap());
static DATE_SEQUENCE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{6,8})[-_ ]?(\d{2,4})$").unwrap());
static CLEAN_NOISE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[-_ ]+").unwrap());

const AMATEUR_PREFIXES: &[&str] = &["SIRO", "GANA", "OREC", "ARA", "MAAN", "JAC", "LUXU", "LAFBD"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CodeKind {
    Standard,
    Fc2,
    Amateur,
    DateSequence,
    SiteNumeric,
    Unknown,
}

impl CodeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Fc2 => "fc2",
            Self::Amateur => "amateur",
            Self::DateSequence => "date_sequence",
            Self::SiteNumeric => "site_numeric",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCode {
    pub canonical: String,
    pub code_norm: String,
    pub kind: CodeKind,
    pub prefix: Option<String>,
    pub number: Option<String>,
    pub suffix: Option<String>,
    pub sort_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchQueryForms {
    pub raw: String,
    pub cleaned: String,
    pub canonical_guess: Option<String>,
    pub code_norm_guess: Option<String>,
    pub prefix_only: Option<String>,
}

pub fn normalize(input: &str) -> String {
    normalize_for_storage(input).canonical
}

pub fn normalize_no_sep(input: &str) -> String {
    normalize_for_storage(input).code_norm
}

pub fn normalize_for_storage(input: &str) -> ParsedCode {
    parse_code(input).unwrap_or_else(|| fallback_unknown(input))
}

pub fn normalize_search_query(input: &str) -> SearchQueryForms {
    let cleaned = clean_input(input);
    if cleaned.is_empty() {
        return SearchQueryForms {
            raw: input.to_string(),
            cleaned,
            canonical_guess: None,
            code_norm_guess: None,
            prefix_only: None,
        };
    }

    let parsed = parse_code(input).unwrap_or_else(|| fallback_unknown(input));
    let prefix_only = extract_prefix_hint(&cleaned).or_else(|| parsed.prefix.clone());

    SearchQueryForms {
        raw: input.to_string(),
        cleaned,
        canonical_guess: Some(parsed.canonical),
        code_norm_guess: Some(parsed.code_norm),
        prefix_only,
    }
}

pub fn parse_code(input: &str) -> Option<ParsedCode> {
    let cleaned = clean_input(input);
    if cleaned.is_empty() {
        return None;
    }

    if let Some(captures) = FC2_RE.captures(&cleaned) {
        let number = captures.get(1)?.as_str().to_string();
        return Some(build_parsed_code(
            format!("FC2-PPV-{}", number),
            CodeKind::Fc2,
            Some("FC2".into()),
            Some(number),
            None,
        ));
    }

    if let Some(captures) = SITE_NUMERIC_RE.captures(&cleaned) {
        let prefix = captures.get(1)?.as_str().to_uppercase();
        let number = captures.get(2)?.as_str().to_string();
        return Some(build_parsed_code(
            format!("{}-{}", prefix, number),
            CodeKind::SiteNumeric,
            Some(prefix),
            Some(number),
            None,
        ));
    }

    if let Some(captures) = STANDARD_SUFFIX_RE.captures(&cleaned) {
        let prefix = captures.get(1)?.as_str().to_uppercase();
        let number = captures.get(2)?.as_str().to_string();
        let suffix = captures.get(3)?.as_str().to_uppercase();
        let kind = if AMATEUR_PREFIXES.contains(&prefix.as_str()) {
            CodeKind::Amateur
        } else {
            CodeKind::Standard
        };
        return Some(build_parsed_code(
            format!("{}-{}{}", prefix, number, suffix),
            kind,
            Some(prefix),
            Some(number),
            Some(suffix),
        ));
    }

    if let Some(captures) = STANDARD_RE.captures(&cleaned) {
        let prefix = captures.get(1)?.as_str().to_uppercase();
        let number = captures.get(2)?.as_str().to_string();
        let kind = if AMATEUR_PREFIXES.contains(&prefix.as_str()) {
            CodeKind::Amateur
        } else {
            CodeKind::Standard
        };
        return Some(build_parsed_code(
            format!("{}-{}", prefix, number),
            kind,
            Some(prefix),
            Some(number),
            None,
        ));
    }

    if let Some(captures) = DATE_SEQUENCE_RE.captures(&cleaned) {
        let date = captures.get(1)?.as_str().to_string();
        let seq = captures.get(2)?.as_str().to_string();
        return Some(build_parsed_code(
            format!("{}-{}", date, seq),
            CodeKind::DateSequence,
            None,
            Some(date),
            Some(seq),
        ));
    }

    Some(fallback_unknown(input))
}

pub fn extract_series(code: &str) -> Option<String> {
    let parsed = parse_code(code)?;
    match parsed.kind {
        CodeKind::Standard | CodeKind::Amateur | CodeKind::Fc2 => parsed.prefix,
        CodeKind::DateSequence | CodeKind::SiteNumeric | CodeKind::Unknown => None,
    }
}

fn build_parsed_code(
    canonical: String,
    kind: CodeKind,
    prefix: Option<String>,
    number: Option<String>,
    suffix: Option<String>,
) -> ParsedCode {
    let sort_key = build_sort_key(&kind, prefix.as_deref(), number.as_deref(), suffix.as_deref(), &canonical);

    ParsedCode {
        code_norm: canonical.replace('-', ""),
        canonical,
        kind,
        prefix,
        number,
        suffix,
        sort_key,
    }
}

fn build_sort_key(
    kind: &CodeKind,
    prefix: Option<&str>,
    number: Option<&str>,
    suffix: Option<&str>,
    canonical: &str,
) -> String {
    match kind {
        CodeKind::Standard | CodeKind::Amateur | CodeKind::Fc2 | CodeKind::SiteNumeric => format!(
            "{}|{}|{}",
            prefix.unwrap_or(""),
            zero_pad(number.unwrap_or(""), 12),
            suffix.unwrap_or("")
        ),
        CodeKind::DateSequence => format!(
            "DATE|{}|{}",
            number.unwrap_or(""),
            zero_pad(suffix.unwrap_or(""), 6)
        ),
        CodeKind::Unknown => canonical.to_string(),
    }
}

fn clean_input(input: &str) -> String {
    let trimmed = input.trim().to_uppercase();
    let unified = CLEAN_NOISE_RE.replace_all(&trimmed, "-");
    unified.trim_matches('-').to_string()
}

fn fallback_unknown(input: &str) -> ParsedCode {
    let cleaned = clean_input(input);
    build_parsed_code(cleaned, CodeKind::Unknown, None, None, None)
}

fn extract_prefix_hint(cleaned: &str) -> Option<String> {
    let prefix: String = cleaned.chars().take_while(|ch| ch.is_ascii_alphabetic()).collect();
    if prefix.len() >= 2 {
        Some(prefix)
    } else {
        None
    }
}

fn zero_pad(value: &str, width: usize) -> String {
    if value.is_empty() {
        return String::new();
    }

    if value.chars().all(|ch| ch.is_ascii_digit()) {
        format!("{:0>width$}", value, width = width)
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize() {
        assert_eq!(normalize("ipx-123"), "IPX-123");
        assert_eq!(normalize("IPX123"), "IPX-123");
        assert_eq!(normalize("ipx_123"), "IPX-123");
        assert_eq!(normalize("ipx 123"), "IPX-123");
        assert_eq!(normalize("  IPX-123  "), "IPX-123");
        assert_eq!(normalize("FC2-PPV-1234567"), "FC2-PPV-1234567");
        assert_eq!(normalize("heyzo 3850"), "HEYZO-3850");
        assert_eq!(normalize("051926_001"), "051926-001");
    }

    #[test]
    fn test_extract_series() {
        assert_eq!(extract_series("IPX-123"), Some("IPX".into()));
        assert_eq!(extract_series("FC2-PPV-1234567"), Some("FC2".into()));
        assert_eq!(extract_series("  ssis-045  "), Some("SSIS".into()));
        assert_eq!(extract_series("051926-001"), None);
        assert_eq!(extract_series("HEYZO-3850"), None);
    }

    #[test]
    fn canonicalizes_standard_codes() {
        let parsed = parse_code(" ipx123 ").expect("recognized code");
        assert_eq!(parsed.canonical, "IPX-123");
        assert_eq!(parsed.code_norm, "IPX123");
        assert_eq!(parsed.kind, CodeKind::Standard);
        assert_eq!(parsed.prefix.as_deref(), Some("IPX"));
        assert_eq!(parsed.number.as_deref(), Some("123"));
    }

    #[test]
    fn canonicalizes_fc2_codes() {
        let parsed = parse_code("fc2ppv1234567").expect("recognized code");
        assert_eq!(parsed.canonical, "FC2-PPV-1234567");
        assert_eq!(parsed.code_norm, "FC2PPV1234567");
        assert_eq!(parsed.kind, CodeKind::Fc2);
    }

    #[test]
    fn canonicalizes_site_numeric_codes() {
        let parsed = parse_code("heyzo 3850").expect("recognized code");
        assert_eq!(parsed.canonical, "HEYZO-3850");
        assert_eq!(parsed.kind, CodeKind::SiteNumeric);
        assert_eq!(parsed.prefix.as_deref(), Some("HEYZO"));
    }

    #[test]
    fn canonicalizes_date_sequence_codes() {
        let parsed = parse_code("051926_001").expect("recognized code");
        assert_eq!(parsed.canonical, "051926-001");
        assert_eq!(parsed.kind, CodeKind::DateSequence);
    }

    #[test]
    fn leaves_unknown_codes_cleaned_but_not_overwritten() {
        let parsed = parse_code("custom code x").expect("fallback code");
        assert_eq!(parsed.canonical, "CUSTOM-CODE-X");
        assert_eq!(parsed.kind, CodeKind::Unknown);
    }

    #[test]
    fn builds_search_forms_for_partial_queries() {
        let query = normalize_search_query("ipx 123");
        assert_eq!(query.canonical_guess.as_deref(), Some("IPX-123"));
        assert_eq!(query.code_norm_guess.as_deref(), Some("IPX123"));
        assert_eq!(query.prefix_only.as_deref(), Some("IPX"));
    }
}

// macOS WKWebView runs system autocorrect inside text fields (e.g. rewriting
// "postgres" → "Postgres" in the connection form). These attributes disable
// it; spread onto every free-text <input>/<textarea>. `autocapitalize` is
// included because on form controls it does NOT inherit from <body>.
export const noAutocorrect = {
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

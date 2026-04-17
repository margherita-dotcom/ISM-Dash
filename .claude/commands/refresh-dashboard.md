Trigger a rebuild of the ISM Dashboard with fresh Aircall data.

This dispatches the GitHub Actions workflow which will:
1. Fetch all calls from Aircall API (year to date)
2. Run AI sentiment + topic analysis (if ANTHROPIC_API_KEY is configured)
3. Build and deploy to GitHub Pages

Run:

```bash
curl -s -X POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/margherita-dotcom/ISM-Dash/actions/workflows/deploy.yml/dispatches" \
  -d '{"ref":"main"}' \
  && echo "Workflow triggered. Dashboard refreshes at https://margherita-dotcom.github.io/ISM-Dash/ in ~3-5 minutes."
```

Set GITHUB_PAT in your shell environment before running:
  export GITHUB_PAT=your_github_personal_access_token

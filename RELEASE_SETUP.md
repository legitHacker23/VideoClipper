# Release Setup Instructions

## GitHub Personal Access Token Setup

To enable automated releases, you need to create a GitHub Personal Access Token:

### 1. Create Personal Access Token
1. Go to GitHub → Settings → Developer Settings → "Personal access tokens (classic)"
2. Click "Generate new token (classic)"
3. Give it a name like "YTClips Desktop Releases"
4. Set expiration (recommend: 90 days)
5. **Check these scopes:**
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)

### 2. Add Token to Repository Secrets
1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GH_TOKEN`
4. Value: Paste your Personal Access Token
5. Click "Add secret"

### 3. Test the Setup
After setting up the token, you can test the release process:

```bash
npm version patch  # bumps version and creates git tag
git push --follow-tags  # triggers GitHub Actions
```

The workflow will automatically build and publish installers to GitHub Releases when you push a version tag.

## Release Process

To release a new version:

```bash
npm version minor       # bumps version and creates git tag
git push --follow-tags  # triggers GitHub Actions
```

This will:
- Build installers for macOS, Windows, and Linux
- Upload them to GitHub Releases
- Enable auto-updates for users 
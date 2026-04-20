New: .github/workflows/build-push.yml — triggers on v*.*.* tags, builds both images with GHA layer caching, pushes to ghcr.io using the built-in GITHUB_TOKEN.

Modified: docker-compose.yml — build: blocks replaced with image: references; removed the no-op VITE_API_BASE_URL runtime env var from the frontend service.

One-time setup after your first tag push:

After the workflow runs for the first time, the packages will be private by default. Go to:

github.com/DropzoneNinja → Packages → flightops-backend → Package Settings → Change visibility → Public
Repeat for flightops-frontend
Then on your production server, docker compose pull && docker compose up -d will just work with no auth needed.

Ongoing deploy flow:


git tag v1.2.0 && git push --tags   # triggers the build (~3–5 min)
# then on server:
docker compose pull && docker compose up -d


Version management:
npm --prefix ./frontend version 1.5.2 --no-git-tag-version
npm --prefix ./backend version 1.5.2 --no-git-tag-version
git add frontend/package.json backend/package.json
git commit -m "v1.5.2"
git tag v1.5.2
git push && git push --tags

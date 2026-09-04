# START HERE — no coding required

You do not need to edit the code to get RugPrint online.

## 1. Create the GitHub repository

1. Sign in to GitHub.
2. Click **+** in the top-right → **New repository**.
3. Repository name: `rugprint`.
4. Choose **Private** while testing. You can make it public later.
5. Do **not** add a README, .gitignore or license because this folder already contains them.
6. Click **Create repository**.

## 2. Upload this project

The easiest no-code route is GitHub Desktop:

1. Install GitHub Desktop and sign in.
2. Unzip the RugPrint download.
3. In GitHub Desktop choose **File → Add local repository** and select the unzipped `rugprint` folder.
4. If prompted to create a repository there, accept.
5. Commit all files with the message `Initial RugPrint build`.
6. Choose **Publish repository** and make sure the repository belongs to your GitHub account.

If you already created the empty repo on GitHub, GitHub Desktop can publish/attach the local repository to it.

## 3. Create a Helius key

RugPrint works against standard Solana RPC, but a dedicated provider is much more reliable.

1. Create a Helius account.
2. Create a Solana API key.
3. Copy the key. Do not post it publicly and do not commit it to GitHub.

## 4. Put RugPrint online with Vercel

1. Sign into Vercel using GitHub.
2. Choose **Add New → Project**.
3. Import `rugprint`.
4. Open **Environment Variables**.
5. Add `HELIUS_API_KEY` and paste your Helius key as the value.
6. Deploy.

Vercel will detect Next.js automatically.

## 5. Test it

1. Open the Vercel URL.
2. Paste a real Solana token mint address.
3. Press **Trace token**.
4. Check that the evidence cards and Solscan links appear.
5. Try several tokens before sharing RugPrint publicly.

## What not to do

- Never enter a seed phrase or private key. RugPrint never needs one.
- Do not call a wallet owner a criminal just because RugPrint shows a relationship.
- Do not publish private personal information.
- Do not expose `HELIUS_API_KEY` in browser code or add `NEXT_PUBLIC_` to it.

## When something breaks

Copy the exact Vercel error or send a screenshot of it back to ChatGPT. The codebase is structured so individual parsers and scoring rules can be repaired without rebuilding the site from scratch.

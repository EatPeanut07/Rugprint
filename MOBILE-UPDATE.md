# Update RugPrint from a phone

You do not need a computer or GitHub Desktop.

1. Download `rugprint-creator-intelligence-upgrade.zip` from ChatGPT.
2. Open the Files/My Files app on your phone and extract the ZIP.
3. Open GitHub in Chrome or Samsung Internet and sign in.
4. Open your RugPrint repository.
5. Because GitHub mobile upload is awkward for replacing many nested files, turn on **Desktop site** in your browser menu if needed.
6. Use **Add file → Upload files**.
7. Upload the contents of the extracted folder, preserving the same paths. Do not upload the outer folder as an extra folder level.
8. Commit the changes to `main` with a message such as `Upgrade creator intelligence engine`.
9. Vercel should automatically start a new deployment from the GitHub commit.
10. Open Vercel on your phone, select RugPrint, and check the latest deployment. If it says Ready, open the site and rescan the same benchmark token.

If GitHub's mobile browser refuses to replace nested folders cleanly, update only these files first:

- `lib/solana.ts`
- `lib/types.ts`
- `components/Scanner.tsx`
- `app/page.tsx`
- `app/globals.css`
- `.env.example`

Those are the files that change the application behavior. Documentation files are optional for deployment.

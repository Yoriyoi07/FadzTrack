# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

---

## Auth: Short Expiry Test (Remember Me Verification)

To quickly verify that silent refresh keeps a remembered session alive without manual interaction, temporarily shorten lifetimes:

1. Edit `backend/.env` (or export in shell) adding:
	```env
	ACCESS_TTL_SEC=60            # access tokens 1 minute
	SHORT_REFRESH_TTL_SEC=180    # non-remembered refresh ~3 minutes
	REFRESH_TTL_SEC=3600         # remembered refresh 1 hour
	```
2. Restart the backend server.
3. Login, complete 2FA with the "Remember this device" checkbox checked.
4. Open DevTools > Application > Local Storage. Copy the `token` and decode at https://jwt.io to see `exp`. 
5. Wait ~50 seconds (no clicks). A background call to `/auth/refresh-token` should occur before expiry; the stored `token` value changes automatically.
6. Repeat a few cycles to confirm continuous renewal. After 1 hour (refresh expiry) the session will end and you’ll be redirected.
7. Revert the env values (or remove them) and restart backend when done.

If refresh fails you will see a redirect to the login page; check that the `refreshToken` cookie still exists and that system time is correct.

---

## IT Bulk Account Import

IT users can create many accounts at once using a CSV upload.

CSV Requirements:

```
name,email,role,phone
Jane Doe,jane.doe@example.com,Project Manager,09171234567
Juan Dela Cruz,juan.cruz@example.com,Area Manager,09181234567
```

Rules:
1. Required headers: `name,email,role` (phone optional).
2. Roles must match existing role labels (e.g. Project Manager, Area Manager, HR, Person in Charge, Staff, HR - Site).
3. Existing emails are skipped (reported as `exists`).
4. New accounts get a random temp password and an activation email (status starts Inactive until activated).
5. Activation links expire after 4 hours (configurable if you adjust the code).

UI Flow:
1. Go to IT Dashboard sidebar.
2. In "Bulk Accounts Import" choose your CSV file.
3. (Optional) Leave "Dry run" checked to validate without creating accounts or sending emails. You will see which rows WOULD be created (status `would_create`).
4. Real-time progress bar updates via `bulkRegisterProgress` socket events (percent = processed / total).
5. After completion, review summary (Created / Existing / Failed) and expand details.
6. Download sample: `sample_accounts_import.csv` (located in repo root) if needed.

API:
`POST /api/auth/bulk-register` (multipart/form-data, field name: `file`).

Response shape:
```
{
	summary: { totalRows, created, existing, failed },
	results: [ { line, email, status, reason? }, ... ]
}
```

Statuses per row: `created`, `exists`, `invalid`, `error`, `would_create` (dry run only).

Security Recommendation: protect this endpoint so only IT/admin roles can access (add middleware verify + role check if needed).


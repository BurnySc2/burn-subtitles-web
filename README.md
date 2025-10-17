# Burn Subtitles Website

To try out fonts locally, you can save the fonts to `~/.fonts/` and they will be seen by linux and listed in DaVinci Resolve.


## Developing

Once you've created a project and installed dependencies with `npm install`, start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Update typescript types

There may be a problem keeping the types up to date with the backend api.

While backend is running under, you can run

```sh
npx openapi-typescript http://localhost:8000/schema/openapi.json --output src/lib/types/api.ts
```

to update the types of the endpoints.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

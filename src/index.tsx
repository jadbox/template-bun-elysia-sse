import { Elysia, sse } from "elysia";
import { html } from "@elysiajs/html";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { EventEmitter, on } from "node:events";

const ee = new EventEmitter();
ee.setMaxListeners(100); // Support up to 100 concurrent SSE clients
let counter = 0;

const FormButton = () => (
  <form action="/increment" method="POST">
    <button
      hx-post="/increment"
      hx-target="#counter-container"
      hx-swap="outerHTML"
      className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md active:scale-95"
    >
      Increment
    </button>
  </form>
);

const Counter = ({ value }: { value: number }) => (
  <div
    id="counter-container"
    className="flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-lg"
  >
    <h1 className="text-4xl font-bold text-gray-800">Counter: {value}</h1>
    {/*
      Button both triggers an update, targets where to update, and binds to SSE for async updates
    */}
    <FormButton />
  </div>
);

const Layout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Elysia React HTMX Counter</title>
      <script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0-alpha6/dist/htmx.min.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body 
        className="bg-gray-100 min-h-screen flex items-center justify-center"
        hx-config='{ "sse": { "reconnect": true } }'
    >
        <div 
            id="counter-wrapper"
            hx-get="/sse" 
            hx-trigger="load" 
            hx-target="this" 
            hx-swap="innerHTML"
        >
          {children}
        </div>
    </body>
  </html>
);

const app = new Elysia()
  .use(html())
  .onRequest(({ set }) => {
    set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";
    set.headers["Surrogate-Control"] = "no-store";
  })
  .get("/", () => {
    console.log("Serving initial page");
    return renderToString(
      <Layout>
        <Counter value={counter} />
      </Layout>
    );
  })
  .post("/increment", ({ headers }) => {
    counter++;
    console.log("Incrementing counter to:", counter);
    ee.emit("update", counter);

    const isHtmx = headers["hx-request"] === "true";

    if (isHtmx) {
      return renderToString(<Counter value={counter} />);
    }

    return renderToString(
      <Layout>
        <Counter value={counter} />
      </Layout>
    );
  })
  .get("/sse", async function* () {
    const id = Math.random().toString(36).slice(2, 9);
    console.log(`SSE [${id}] connection opened`);
    try {
      for await (const [value] of on(ee, "update")) {
        const data = renderToString(<Counter value={value as number} />).replace(/\r?\n/g, "");
        console.log(`SSE [${id}] sending update:`, value);
        yield sse(data);
      }
    } catch (err) {
      console.error(`SSE [${id}] error:`, err);
    } finally {
      console.log(`SSE [${id}] connection closed`);
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

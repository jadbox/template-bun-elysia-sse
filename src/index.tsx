import { Elysia, sse } from "elysia";
import { html } from "@elysiajs/html";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { EventEmitter } from "node:events";

const ee = new EventEmitter();
let counter = 0;

const Counter = ({ value }: { value: number }) => (
  <div
    id="counter-container"
    className="flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-lg"
  >
    <h1 className="text-4xl font-bold text-gray-800">Counter: {value}</h1>
    /*
      Button both triggers an update, targets where to update, and binds to SSE for async updates
    */
    <button
      hx-post="/increment"
      hx-target="#counter-container"
      hx-swap="outerHTML"
      sse-swap="message" 
      className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md active:scale-95"
    >
      Increment
    </button>
  </div>
);

const Layout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Elysia React HTMX Counter</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="https://unpkg.com/htmx.org@1.9.12/dist/ext/sse.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body className="bg-gray-100 min-h-screen flex items-center justify-center">
      <div hx-ext="sse" sse-connect="/sse">
        <div>
          {children}
        </div>
      </div>
    </body>
  </html>
);

const app = new Elysia()
  .use(html())
  .get("/", () => {
    return renderToString(
      <Layout>
        <Counter value={counter} />
      </Layout>
    );
  })
  .post("/increment", ({ headers }) => {
    counter++;
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
    let resolve: (value: string) => void;
    let promise = new Promise<string>((r) => (resolve = r));

    const listener = (value: number) => {
      resolve(renderToString(<Counter value={value} />));
      promise = new Promise<string>((r) => (resolve = r));
    };

    ee.on("update", listener);

    try {
      while (true) {
        const data = await promise;
        yield sse(data);
      }
    } finally {
      ee.off("update", listener);
      resolve = null!;
      promise = null!;
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

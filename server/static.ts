import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import {
  isKnownClientRoute,
  isNoIndexClientRoute,
  normalizeRequestPath,
  renderNotFoundDocument,
  renderSeoDocument,
} from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf8");

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const route = normalizeRequestPath(req);
    if (req.path === "/index.html") {
      return res.redirect(308, `/${req.url.split("?")[1] ? `?${req.url.split("?")[1]}` : ""}`);
    }
    if (req.path.length > 1 && req.path.endsWith("/")) {
      const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(308, `${route}${query}`);
    }

    if (isNoIndexClientRoute(route)) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }

    if (route === "/" || route === "/faq" || route === "/developers") {
      res.setHeader("X-Robots-Tag", "index, follow");
      res.type("html");
      return res.send(renderSeoDocument(indexHtml, route));
    }

    next();
  });

  app.use(express.static(distPath));

  app.use((req, res) => {
    const route = normalizeRequestPath(req);
    if (isKnownClientRoute(route)) {
      if (isNoIndexClientRoute(route)) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      }
      res.type("html");
      return res.send(indexHtml);
    }

    res.status(404).type("html").send(renderNotFoundDocument());
  });
}

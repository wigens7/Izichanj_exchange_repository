import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeFirebase } from "./lib/firebase";
import "./index.css";

initializeFirebase();

createRoot(document.getElementById("root")!).render(<App />);

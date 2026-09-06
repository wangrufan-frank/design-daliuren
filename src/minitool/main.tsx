import { createRoot } from "react-dom/client";
import { MiniToolApp } from "./MiniToolApp";
import "./minitool.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<MiniToolApp />);

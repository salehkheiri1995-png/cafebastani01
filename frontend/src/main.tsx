import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// نکته: StrictMode عمداً استفاده نشده تا اسکنر دوربین در حالت توسعه دوبار مقداردهی نشود
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Message from "./pages/Message/Message";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/inbox" element={<Message />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
const upload = multer();

// env vars you’ll set on Render
const TNB_EMAIL = process.env.TNB_EMAIL;
const TNB_PASSWORD = process.env.TNB_PASSWORD;

// health check
app.get("/", (req, res) => res.send("Somarra Try-On server is live"));

// POST  /tryon/render  — forwards to The New Black /vto
app.post("/tryon/render", upload.single("photo"), async (req, res) => {
  try {
    const { clothing_photo, clothing_type } = req.body;
    const photo = req.file;
    if (!photo || !clothing_photo) {
      return res.status(400).json({ error: "Missing photo or clothing_photo" });
    }

    const fd = new FormData();
    fd.append("email", TNB_EMAIL);
    fd.append("password", TNB_PASSWORD);
    fd.append("model_photo", photo.buffer, { filename: photo.originalname || "photo.jpg" });
    fd.append("clothing_photo", clothing_photo);
    fd.append("clothing_type", clothing_type || "tops");

    const tnb = await fetch("https://thenewblack.ai/api/1.1/wf/vto", { method: "POST", body: fd });
    if (!tnb.ok) return res.status(502).json({ error: "TNB /vto error", detail: await tnb.text() });

    // The New Black returns just a text id, not JSON
    const jobId = (await tnb.text()).trim();
    return res.json({ job_id: jobId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "render failed" });
  }
});

// GET /tryon/status?job_id=... — polls TNB /results
app.get("/tryon/status", async (req, res) => {
  try {
    const job_id = req.query.job_id;
    if (!job_id) return res.status(400).json({ error: "Missing job_id" });

    const fd = new FormData();
    fd.append("email", TNB_EMAIL);
    fd.append("password", TNB_PASSWORD);
    fd.append("id", job_id);

    const tnb = await fetch("https://thenewblack.ai/api/1.1/wf/results", { method: "POST", body: fd });
    if (!tnb.ok) return res.status(502).json({ error: "TNB /results error", detail: await tnb.text() });

    const url = (await tnb.text()).trim(); // final image URL
    return res.json({ status: "done", image_url: url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "status failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Somarra Try-On listening on ${PORT}`));

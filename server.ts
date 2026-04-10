import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory store for demo purposes (since Firebase was declined)
  const db = {
    patients: [
      { id: "p1", name: "Aryan Pandey", age: 25, gender: "Male", phone: "+91 98765 43210" },
      { id: "p2", name: "Shruti Sharma", age: 24, gender: "Female", phone: "+91 88776 65544" }
    ],
    consultations: [],
    queue: [
      { id: "q1", patient_id: "p1", status: "waiting", time: new Date().toISOString() },
      { id: "q2", patient_id: "p2", status: "in-consultation", time: new Date().toISOString() }
    ]
  };

  // API Routes
  app.get("/api/patients", (req, res) => {
    res.json(db.patients);
  });

  app.get("/api/patients/:id", (req, res) => {
    const patient = db.patients.find(p => p.id === req.params.id);
    res.json(patient || null);
  });

  app.post("/api/patients", (req, res) => {
    const newPatient = { ...req.body, id: `p${db.patients.length + 1}` };
    db.patients.push(newPatient);
    res.json(newPatient);
  });

  app.get("/api/queue", (req, res) => {
    const queueWithDetails = db.queue.map(q => ({
      ...q,
      patient: db.patients.find(p => p.id === q.patient_id)
    }));
    res.json(queueWithDetails);
  });

  app.post("/api/queue", (req, res) => {
    const { patient_id } = req.body;
    const existing = db.queue.find(q => q.patient_id === patient_id && q.status !== "completed");
    if (existing) return res.json(existing);
    
    const newItem = { 
      id: `q${db.queue.length + 1}`, 
      patient_id, 
      status: "waiting", 
      time: new Date().toISOString() 
    };
    db.queue.push(newItem);
    res.json(newItem);
  });

  app.patch("/api/queue/:id", (req, res) => {
    const item = db.queue.find(q => q.id === req.params.id);
    if (item) {
      Object.assign(item, req.body);
    }
    res.json(item || null);
  });

  app.get("/api/consultations/:patientId", (req, res) => {
    const records = db.consultations.filter(c => c.patient_id === req.params.patientId);
    res.json(records);
  });

  app.post("/api/consultations", (req, res) => {
    const consultation = { 
      ...req.body, 
      id: `c${db.consultations.length + 1}`, 
      created_at: new Date().toISOString() 
    };
    db.consultations.push(consultation);
    
    // Update queue status if applicable
    const queueItem = db.queue.find(q => q.patient_id === consultation.patient_id && q.status === "in-consultation");
    if (queueItem) {
      queueItem.status = "completed";
    }

    res.json(consultation);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

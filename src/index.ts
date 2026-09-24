import express from "express";

const app = express();
const PORT = 3000;

//express.json()
//es un middleware que convierte el body de las peticiones JSON en un objeto (req.body).

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "API de ive-store funcionando" });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
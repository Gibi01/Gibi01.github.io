import AltaCatalogo from '../Componentes/AltaCatalogo';
import { Link as RouterLink } from 'react-router-dom';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
// src/Paginas/AdminCargaDatos.tsx
// pagina de admin para el alta de especialidades, doctores y agendas
// solo entra un admin (RutaAdmin)

import { useEffect, useState, type FormEvent } from "react";
import {
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import type { Especialidad } from "../Tipos/dominio";

import { getEspecialidades } from "../Servicios/especialidadesService";
import { crearDoctor } from "../Servicios/doctoresService";


export default function AdminCargaDatos() {
  const [tab, setTab] = useState(0);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);

  const cargarListas = () => {
    getEspecialidades().then(setEspecialidades).catch(() => {});
  };

  useEffect(() => {
    cargarListas();
  }, []);

  return (
    <Container maxWidth={tab === 0 || tab === 3 || tab === 4 ? "lg" : "sm"} sx={{ py: 4 }}>
      <Paper variant="outlined">
        <Box sx={{ p: 3, pb: 0 }}>
        <EncabezadoPagina>
          <Typography variant="h4" component="h1" gutterBottom>
            Cargar datos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Alta de especialidades, doctores, agendas, obras sociales y motivos de cancelación.
          </Typography>
        </EncabezadoPagina>
        </Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mt: 2 }}>
          <Tab label="Especialidad" />
          <Tab label="Doctor" />
          <Tab label="Agenda" />
          <Tab label="Obra social" />
          <Tab label="Motivo de cancelación" />
        </Tabs>
        <Box sx={{ p: 3 }}>
          {tab === 0 && <AltaCatalogo key="especialidad" tipo="especialidad" onCreado={cargarListas} />}
          {tab === 1 && <FormDoctor especialidades={especialidades} onCreado={cargarListas} />}
          {tab === 2 && <Button component={RouterLink} to="/admin/agendas" variant="contained">Abrir editor de agendas</Button>}
          {tab === 3 && <AltaCatalogo key="obraSocial" tipo="obraSocial" onCreado={cargarListas} />}
          {tab === 4 && <AltaCatalogo key="motivo" tipo="motivo" onCreado={cargarListas} />}
        </Box>
      </Paper>
    </Container>
  );
}

function FormDoctor({
  especialidades,
  onCreado,
}: {
  especialidades: Especialidad[];
  onCreado: () => void;
}) {
  const [matricula, setMatricula] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [especialidadIds, setEspecialidadIds] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!matricula || !nombre.trim() || !apellido.trim() || !email.trim() || !password || !dni.trim()) {
      setError("Completá matrícula, nombre, apellido, email, contraseña y DNI.");
      return;
    }
    setGuardando(true);
    try {
      await crearDoctor({
        matricula: Number(matricula),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password,
        dni: dni.trim(),
        especialidadIds,
      });
      setMatricula("");
      setNombre("");
      setApellido("");
      setEmail("");
      setPassword("");
      setDni("");
      setEspecialidadIds([]);
      setOk(true);
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el doctor.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Doctor creado. Ya puede iniciar sesión con el email y contraseña cargados.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField
        fullWidth
        margin="normal"
        type="number"
        label="Matrícula"
        value={matricula}
        onChange={(e) => setMatricula(e.target.value)}
      />
      <TextField
        fullWidth
        margin="normal"
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <TextField
        fullWidth
        margin="normal"
        label="Apellido"
        value={apellido}
        onChange={(e) => setApellido(e.target.value)}
      />
      <TextField
        fullWidth
        margin="normal"
        label="DNI"
        value={dni}
        onChange={(e) => setDni(e.target.value)}
      />
      <TextField
        fullWidth
        margin="normal"
        type="email"
        label="Email (para iniciar sesión)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        fullWidth
        margin="normal"
        type="password"
        label="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        fullWidth
        select
        margin="normal"
        label="Especialidades"
        slotProps={{ select: { multiple: true } }}
        value={especialidadIds}
        onChange={(e) => setEspecialidadIds(e.target.value as unknown as number[])}
      >
        {especialidades.map((esp) => (
          <MenuItem key={esp.idEspecialidad} value={esp.idEspecialidad}>
            {esp.descripcionEsp}
          </MenuItem>
        ))}
      </TextField>
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={guardando}>
        {guardando ? <CircularProgress size={24} color="inherit" /> : "Crear doctor"}
      </Button>
    </Box>
  );
}

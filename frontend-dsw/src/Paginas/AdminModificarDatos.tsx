import { Link as RouterLink } from 'react-router-dom';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
// src/Paginas/AdminModificarDatos.tsx
// pagina de admin para editar/eliminar especialidades, doctores y agendas ya cargadas
// solo entra un admin (RutaAdmin). el alta esta en AdminCargaDatos.tsx

import { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
  MenuItem,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SelectorIconoEspecialidad from '../Componentes/SelectorIconoEspecialidad';
import IconoEspecialidad from '../Componentes/IconoEspecialidad';
import DeleteIcon from "@mui/icons-material/Delete";
import type { Doctor, Especialidad, MotivoCancelacion, ObraSocial } from "../Tipos/dominio";
import {
  getEspecialidades,
  actualizarEspecialidad,
  eliminarEspecialidad,
} from "../Servicios/especialidadesService";
import { getDoctores, actualizarDoctor, darDeBajaDoctor } from "../Servicios/doctoresService";
import {
  getObrasSociales,
  actualizarObraSocial,
  eliminarObraSocial,
} from "../Servicios/obraSocialService";
import {
  getMotivosCancelacion,
  actualizarMotivoCancelacion,
  eliminarMotivoCancelacion,
} from "../Servicios/motivoCancelacionService";


export default function AdminModificarDatos() {
  const [tab, setTab] = useState(0);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper variant="outlined">
        <Box sx={{ p: 3, pb: 0 }}>
        <EncabezadoPagina>
          <Typography variant="h4" component="h1" gutterBottom>
            Modificar datos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Editá o eliminá especialidades, doctores, agendas, obras sociales y motivos de
            cancelación ya cargados.
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
        <Box sx={{ p: 2 }}>
          {tab === 0 && <ListaEspecialidades />}
          {tab === 1 && <ListaDoctores />}
          {tab === 2 && <Button component={RouterLink} to="/admin/agendas" variant="contained">Abrir editor de agendas</Button>}
          {tab === 3 && <ListaObrasSociales />}
          {tab === 4 && <ListaMotivosCancelacion />}
        </Box>
      </Paper>
    </Container>
  );
}

function ListaEspecialidades() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<Especialidad | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [icono, setIcono] = useState('medicina');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [borrando, setBorrando] = useState<Especialidad | null>(null);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    getEspecialidades()
      .then(setEspecialidades)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar las especialidades.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirEdicion = (esp: Especialidad) => {
    setEditando(esp);
    setDescripcion(esp.descripcionEsp);
    setIcono(esp.icono || 'medicina');
    setErrorForm(null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    setErrorForm(null);
    try {
      await actualizarEspecialidad(editando.idEspecialidad, { descripcionEsp: descripcion, icono });
      setEditando(null);
      cargar();
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    setErrorBorrar(null);
    try {
      await eliminarEspecialidad(borrando.idEspecialidad);
      setBorrando(null);
      cargar();
    } catch (err) {
      setErrorBorrar(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (especialidades.length === 0) return <Alert severity="info">No hay especialidades cargadas.</Alert>;

  return (
    <>
      <List>
        {especialidades.map((esp) => (
          <ListItem
            key={esp.idEspecialidad}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton aria-label={`Editar ${esp.descripcionEsp}`} edge="end" onClick={() => abrirEdicion(esp)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  color="error"
                  onClick={() => {
                    setBorrando(esp);
                    setErrorBorrar(null);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            }
          >
            <Box sx={{ mr: 2 }}><IconoEspecialidad icono={esp.icono} /></Box>
            <ListItemText primary={esp.descripcionEsp} secondary={`Id ${esp.idEspecialidad}`} sx={{ pr: 8, overflowWrap: 'anywhere' }} />
          </ListItem>
        ))}
      </List>

      <Dialog open={editando !== null} onClose={() => setEditando(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar especialidad</DialogTitle>
        <DialogContent>
          {errorForm && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorForm}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <SelectorIconoEspecialidad valor={icono} onChange={setIcono} nombre={descripcion} disabled={guardando} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarEdicion} disabled={guardando}>
            {guardando ? <CircularProgress size={20} color="inherit" /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={borrando !== null} onClose={() => setBorrando(null)}>
        <DialogTitle>Eliminar especialidad</DialogTitle>
        <DialogContent>
          {errorBorrar && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorBorrar}
            </Alert>
          )}
          <Typography>¿Seguro que querés eliminar "{borrando?.descripcionEsp}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBorrando(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmarBorrado}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ListaDoctores() {
  const [doctores, setDoctores] = useState<Doctor[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<Doctor | null>(null);
  const [especialidadIds, setEspecialidadIds] = useState<number[]>([]);
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [dandoBaja, setDandoBaja] = useState<Doctor | null>(null);
  const [errorBaja, setErrorBaja] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    // siendo admin, getDoctores tambien trae los dados de baja
    Promise.all([getDoctores(), getEspecialidades()])
      .then(([docs, esps]) => {
        setDoctores(docs);
        setEspecialidades(esps);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los doctores."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirEdicion = (doc: Doctor) => {
    setEditando(doc);
    setEspecialidadIds(doc.especialidades?.map((e) => e.idEspecialidad) ?? []);
    setActivo(doc.activo ?? true);
    setErrorForm(null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    setErrorForm(null);
    try {
      await actualizarDoctor(editando.matricula, { especialidadIds, activo });
      setEditando(null);
      cargar();
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBaja = async () => {
    if (!dandoBaja) return;
    setErrorBaja(null);
    try {
      await darDeBajaDoctor(dandoBaja.matricula);
      setDandoBaja(null);
      cargar();
    } catch (err) {
      setErrorBaja(err instanceof Error ? err.message : "No se pudo dar de baja.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (doctores.length === 0) return <Alert severity="info">No hay doctores cargados.</Alert>;

  return (
    <>
      <List>
        {doctores.map((doc) => (
          <ListItem
            key={doc.matricula}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton edge="end" onClick={() => abrirEdicion(doc)}>
                  <EditIcon />
                </IconButton>
                {doc.activo !== false && (
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={() => {
                      setDandoBaja(doc);
                      setErrorBaja(null);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
            }
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <span>Dr./Dra. {doc.nombre} {doc.apellido}</span>
                  {doc.activo === false && <Chip size="small" color="default" label="Dado de baja" />}
                </Stack>
              }
              secondary={`Matrícula ${doc.matricula} — ${
                doc.especialidades?.map((e) => e.descripcionEsp).join(", ") || "sin especialidad"
              }`}
            />
          </ListItem>
        ))}
      </List>

      <Dialog open={editando !== null} onClose={() => setEditando(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar doctor</DialogTitle>
        <DialogContent>
          {errorForm && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorForm}
            </Alert>
          )}
          {editando && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Dr./Dra. {editando.nombre} {editando.apellido} — matrícula {editando.matricula}
            </Typography>
          )}
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
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Switch checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
            label={activo ? "Activo" : "Dado de baja"}
          />
          {!activo && editando?.activo !== false && <Alert severity="warning">Al guardar, se cancelarán sus turnos futuros pendientes y se encolarán los correos a los pacientes. Reactivarlo no recupera esas reservas.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarEdicion} disabled={guardando}>
            {guardando ? <CircularProgress size={20} color="inherit" /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dandoBaja !== null} onClose={() => setDandoBaja(null)}>
        <DialogTitle>Dar de baja al doctor</DialogTitle>
        <DialogContent>
          {errorBaja && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorBaja}
            </Alert>
          )}
          <Typography>
            ¿Seguro que querés dar de baja a {dandoBaja?.nombre} {dandoBaja?.apellido}? Se cancelarán sus turnos futuros pendientes y se notificará por correo a los pacientes.
            Se conservará el historial. Reactivarlo después no reactivará los turnos cancelados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDandoBaja(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmarBaja}>
            Dar de baja
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ListaObrasSociales() {
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<ObraSocial | null>(null);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [borrando, setBorrando] = useState<ObraSocial | null>(null);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    getObrasSociales()
      .then(setObrasSociales)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar las obras sociales.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirEdicion = (os: ObraSocial) => {
    setEditando(os);
    setNombre(os.nombre);
    setErrorForm(null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    setErrorForm(null);
    try {
      await actualizarObraSocial(editando.id, { nombre });
      setEditando(null);
      cargar();
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    setErrorBorrar(null);
    try {
      await eliminarObraSocial(borrando.id);
      setBorrando(null);
      cargar();
    } catch (err) {
      setErrorBorrar(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (obrasSociales.length === 0) return <Alert severity="info">No hay obras sociales cargadas.</Alert>;

  return (
    <>
      <List>
        {obrasSociales.map((os) => (
          <ListItem
            key={os.id}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton edge="end" onClick={() => abrirEdicion(os)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  color="error"
                  onClick={() => {
                    setBorrando(os);
                    setErrorBorrar(null);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            }
          >
            <ListItemText primary={os.nombre} secondary={`Id ${os.id}`} />
          </ListItem>
        ))}
      </List>

      <Dialog open={editando !== null} onClose={() => setEditando(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar obra social</DialogTitle>
        <DialogContent>
          {errorForm && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorForm}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarEdicion} disabled={guardando}>
            {guardando ? <CircularProgress size={20} color="inherit" /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={borrando !== null} onClose={() => setBorrando(null)}>
        <DialogTitle>Eliminar obra social</DialogTitle>
        <DialogContent>
          {errorBorrar && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorBorrar}
            </Alert>
          )}
          <Typography>¿Seguro que querés eliminar "{borrando?.nombre}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBorrando(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmarBorrado}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ListaMotivosCancelacion() {
  const [motivos, setMotivos] = useState<MotivoCancelacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<MotivoCancelacion | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [borrando, setBorrando] = useState<MotivoCancelacion | null>(null);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    getMotivosCancelacion()
      .then(setMotivos)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los motivos.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirEdicion = (motivo: MotivoCancelacion) => {
    setEditando(motivo);
    setDescripcion(motivo.descripcion);
    setErrorForm(null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    setErrorForm(null);
    try {
      await actualizarMotivoCancelacion(editando.id, { descripcion });
      setEditando(null);
      cargar();
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    setErrorBorrar(null);
    try {
      await eliminarMotivoCancelacion(borrando.id);
      setBorrando(null);
      cargar();
    } catch (err) {
      setErrorBorrar(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (motivos.length === 0) return <Alert severity="info">No hay motivos de cancelación cargados.</Alert>;

  return (
    <>
      <List>
        {motivos.map((motivo) => (
          <ListItem
            key={motivo.id}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton edge="end" onClick={() => abrirEdicion(motivo)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  color="error"
                  onClick={() => {
                    setBorrando(motivo);
                    setErrorBorrar(null);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            }
          >
            <ListItemText primary={motivo.descripcion} secondary={`Id ${motivo.id}`} />
          </ListItem>
        ))}
      </List>

      <Dialog open={editando !== null} onClose={() => setEditando(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar motivo de cancelación</DialogTitle>
        <DialogContent>
          {errorForm && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorForm}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarEdicion} disabled={guardando}>
            {guardando ? <CircularProgress size={20} color="inherit" /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={borrando !== null} onClose={() => setBorrando(null)}>
        <DialogTitle>Eliminar motivo de cancelación</DialogTitle>
        <DialogContent>
          {errorBorrar && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorBorrar}
            </Alert>
          )}
          <Typography>¿Seguro que querés eliminar "{borrando?.descripcion}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBorrando(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmarBorrado}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

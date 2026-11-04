import HorariosPorFranja from '../Componentes/HorariosPorFranja';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
import TituloSeccion from '../Componentes/TituloSeccion';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import PersonOutline from '@mui/icons-material/PersonOutlineRounded';
// src/Paginas/EspecialidadTurnos.tsx
// aca se elige primero el horario disponible (de cualquier doctor de la especialidad) y
// despues se muestra que doctor/es atienden en ese horario para terminar de elegir
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Paper,
  Stack,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Avatar,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import type { ObraSocial, SlotEspecialidad } from "../Tipos/dominio";
import {
  getDisponibilidadEspecialidad,
  getDisponibilidadMesEspecialidad,
  reservarTurno,
} from "../Servicios/turnosService";
import { getObrasSociales } from "../Servicios/obraSocialService";
import { useAuth } from "../Contextos/AuthContext";
import { formatearFechaHora } from "../Servicios/formatoFechaHora";
import ConfirmacionTurno from "../Componentes/ConfirmacionTurno";
import CalendarioTurnos from "../Componentes/CalendarioTurnos";
import { guardarReservaPendiente, leerReservaPendiente, borrarReservaPendiente } from '../Servicios/reservaPendiente';

function hoyISO(): string {
  const hoy = new Date();
  const offsetMs = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function EspecialidadTurnos() {
  const { id } = useParams<{ id: string }>();
  const idEspecialidad = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { estaAutenticado } = useAuth();

  const [fecha, setFecha] = useState(() => leerReservaPendiente(location.pathname)?.fecha ?? hoyISO());
  const [fechasConTurnos, setFechasConTurnos] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<SlotEspecialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [obraSocialId, setObraSocialId] = useState<number | "sin-obra-social" | "">("");
  const [cargandoObrasSociales, setCargandoObrasSociales] = useState(false);

  const [horarioElegido, setHorarioElegido] = useState<string | null>(null);
  const [doctorElegido, setDoctorElegido] = useState<SlotEspecialidad["doctor"] | null>(null);
  const [reservando, setReservando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);

  useEffect(() => {
    if (!idEspecialidad) return;
    let cancelado = false;
    setHorarioElegido(null);
    setDoctorElegido(null);
    setLoading(true);
    setError(null);
    getDisponibilidadEspecialidad(idEspecialidad, fecha)
      .then((disponibles) => {
        if (cancelado) return;
        setSlots(disponibles);
        const pendiente = leerReservaPendiente(location.pathname);
        if (!estaAutenticado || !pendiente || pendiente.fecha !== fecha) return;
        const elegido = disponibles.find(slot => slot.fechaHoraTurno === pendiente.horario && slot.doctor.matricula === pendiente.doctorId);
        if (elegido && Date.parse(pendiente.horario) > Date.now()) {
          setHorarioElegido(pendiente.horario);
          setDoctorElegido(elegido.doctor);
          setObraSocialId(pendiente.obraSocialId);
        } else {
          borrarReservaPendiente();
          setError('El horario que elegiste ya no está disponible. Elegí otro horario.');
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : "No se pudo obtener la disponibilidad.");
      })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [idEspecialidad, fecha, estaAutenticado, location.pathname]);

  useEffect(() => {
    setCargandoObrasSociales(true);
    getObrasSociales()
      .then(setObrasSociales)
      .catch(() => setObrasSociales([]))
      .finally(() => setCargandoObrasSociales(false));
  }, []);

  const cargarMesDisponible = (anio: number, mes: number) => {
    if (!idEspecialidad) return;
    getDisponibilidadMesEspecialidad(idEspecialidad, anio, mes)
      .then((fechas) => setFechasConTurnos(new Set(fechas)))
      .catch(() => {});
  };

  // agrupo por horario porque puede haber mas de un doctor en el mismo momento
  const horarios = useMemo(() => {
    const mapa = new Map<string, SlotEspecialidad["doctor"][]>();
    for (const slot of slots) {
      const lista = mapa.get(slot.fechaHoraTurno) ?? [];
      lista.push(slot.doctor);
      mapa.set(slot.fechaHoraTurno, lista);
    }
    return Array.from(mapa.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [slots]);

  const elegirHorario = (horario: string) => {
    borrarReservaPendiente();
    setHorarioElegido(horario);
    setDoctorElegido(null);
    setErrorReserva(null);
  };

  const elegirDoctor = (doctor: SlotEspecialidad["doctor"]) => {
    if (!horarioElegido) return;
    guardarReservaPendiente({ ruta: location.pathname, fecha, doctorId: doctor.matricula, horario: horarioElegido, obraSocialId: '' });
    if (!estaAutenticado) {
      navigate("/registro", {
        state: { from: location.pathname, mensaje: "Creá una cuenta para reservar un turno." },
      });
      return;
    }
    setDoctorElegido(doctor);
    setErrorReserva(null);
    setObraSocialId("");
  };

  const confirmarReserva = async () => {
    if (!horarioElegido || !doctorElegido || obraSocialId === "" || reservando || confirmado) return;
    guardarReservaPendiente({ ruta: location.pathname, fecha, doctorId: doctorElegido.matricula, horario: horarioElegido, obraSocialId });
    setReservando(true);
    setErrorReserva(null);
    try {
      await reservarTurno(
        doctorElegido.matricula,
        horarioElegido,
        obraSocialId === "sin-obra-social" ? null : obraSocialId
      );
      borrarReservaPendiente();
      setConfirmado(true);
    } catch (err) {
      setErrorReserva(err instanceof Error ? err.message : "No se pudo reservar el turno.");
      const disponibles = await getDisponibilidadEspecialidad(idEspecialidad, fecha).catch(() => null);
      if (disponibles) {
        setSlots(disponibles);
        if (!disponibles.some(s => s.fechaHoraTurno === horarioElegido && s.doctor.matricula === doctorElegido.matricula)) {
          setDoctorElegido(null);
          setHorarioElegido(null);
          borrarReservaPendiente();
          setError('El horario que elegiste ya no está disponible. Elegí otro horario.');
        }
      }
    } finally {
      setReservando(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <EncabezadoPagina>
        <Typography variant="h4" component="h1" gutterBottom>
          Turnos disponibles
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Elegí un día, un horario y después con qué doctor querés atenderte.
        </Typography>
        </EncabezadoPagina>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "380px minmax(0, 1fr)" }, gap: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <TituloSeccion icono={<CalendarMonthOutlined />}>1. Elegí una fecha</TituloSeccion>
            <CalendarioTurnos
              fecha={fecha}
              onCambiarFecha={(nuevaFecha) => { if (nuevaFecha === fecha) return; borrarReservaPendiente(); setFecha(nuevaFecha); setHorarioElegido(null); setDoctorElegido(null); setLoading(true); }}
              fechasConTurnos={fechasConTurnos}
              onCambiarMes={cargarMesDisponible}
            />
          </Box>
          <Box sx={{ minWidth: 0, borderLeft: { md: 1 }, borderColor: { md: "divider" }, pl: { md: 3 } }}>
            <TituloSeccion icono={<AccessTimeOutlined />}>2. Elegí un horario</TituloSeccion>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : horarios.length === 0 ? (
              <Alert severity="info">No hay turnos disponibles para esta fecha.</Alert>
            ) : (
              <Box>
                <HorariosPorFranja key={fecha} horarios={horarios.map(([horario]) => horario)} onContinuar={elegirHorario} onSeleccionar={() => { setHorarioElegido(null); setDoctorElegido(null); }} />
                {horarioElegido ? (
                  <Box component="section" aria-labelledby="doctores-disponibles" sx={{ mt: 3, borderTop: 1, borderColor: "divider", pt: 3 }}>
                    <TituloSeccion id="doctores-disponibles" icono={<PersonOutline />}>
                      Elegí el doctor
                    </TituloSeccion>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Horario: {formatearFechaHora(horarioElegido)}
                    </Typography>
                    <List component="div" disablePadding>
                      {(horarios.find(([h]) => h === horarioElegido)?.[1] ?? []).map((doctor) => (
                        <ListItemButton component="button" key={doctor.matricula} onClick={() => elegirDoctor(doctor)} sx={{ width: "100%", textAlign: "left", border: 1, borderColor: "divider", borderRadius: 1, mb: 1 }}>
                          <Avatar src={doctor.foto ?? undefined} alt={`${doctor.nombre} ${doctor.apellido}`} sx={{ bgcolor: "primary.main", mr: 2 }}>
                            <PersonIcon />
                          </Avatar>
                          <ListItemText
                            primary={`Dr./Dra. ${doctor.nombre} ${doctor.apellido}`}
                            slotProps={{ secondary: { component: "div" } }}
                            secondary={
                              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                                {doctor.especialidades?.map((esp) => (
                                  <Chip key={esp.idEspecialidad} label={esp.descripcionEsp} size="small" />
                                ))}
                              </Stack>
                            }
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mt: 3 }}>Seleccioná un horario para ver los doctores disponibles.</Alert>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      {doctorElegido && horarioElegido && <ConfirmacionTurno
        doctor={doctorElegido} horario={horarioElegido} obrasSociales={obrasSociales} obraSocialId={obraSocialId}
        cargandoObrasSociales={cargandoObrasSociales} reservando={reservando} confirmado={confirmado} error={errorReserva}
        onObraSocial={(seleccion) => {
          setObraSocialId(seleccion);
          guardarReservaPendiente({ ruta: location.pathname, fecha, doctorId: doctorElegido.matricula, horario: horarioElegido, obraSocialId: seleccion });
        }}
        onConfirmar={confirmarReserva}
        onCancelar={() => { borrarReservaPendiente(); setDoctorElegido(null); }}
      />}
    </Container>
  );
}

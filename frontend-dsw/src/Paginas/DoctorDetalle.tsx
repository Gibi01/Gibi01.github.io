import HorariosPorFranja from '../Componentes/HorariosPorFranja';
// src/Paginas/DoctorDetalle.tsx
// pagina de detalle del doctor: info + horarios disponibles de la fecha elegida
// se hace click en un horario, se confirma y listo, se reserva el turno
// ver la agenda es publico, para reservar hay que estar logueado

import { useEffect, useState } from "react";
import TituloSeccion from '../Componentes/TituloSeccion';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Paper,
  Avatar,
  Chip,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import type { Doctor, ObraSocial } from "../Tipos/dominio";
import { getDoctor } from "../Servicios/doctoresService";
import {
  getDisponibilidadDoctor,
  getDisponibilidadMesDoctor,
  reservarTurno,
} from "../Servicios/turnosService";
import { getObrasSociales } from "../Servicios/obraSocialService";
import { useAuth } from "../Contextos/AuthContext";

import ConfirmacionTurno from "../Componentes/ConfirmacionTurno";
import CalendarioTurnos from "../Componentes/CalendarioTurnos";
import { guardarReservaPendiente, leerReservaPendiente, borrarReservaPendiente } from '../Servicios/reservaPendiente';

function hoyISO(): string {
  const hoy = new Date();
  const offsetMs = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function DoctorDetalle() {
  const { matricula } = useParams<{ matricula: string }>();
  const matriculaNum = Number(matricula);
  const navigate = useNavigate();
  const location = useLocation();
  const { estaAutenticado } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [errorDoctor, setErrorDoctor] = useState<string | null>(null);

  const [fecha, setFecha] = useState(() => leerReservaPendiente(location.pathname)?.fecha ?? hoyISO());
  const [fechasConTurnos, setFechasConTurnos] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [errorSlots, setErrorSlots] = useState<string | null>(null);

  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [obraSocialId, setObraSocialId] = useState<number | "sin-obra-social" | "">("");
  const [cargandoObrasSociales, setCargandoObrasSociales] = useState(false);

  const [slotElegido, setSlotElegido] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);

  useEffect(() => {
    if (!matricula) return;
    setLoadingDoctor(true);
    setErrorDoctor(null);
    getDoctor(matriculaNum)
      .then(setDoctor)
      .catch((err) =>
        setErrorDoctor(err instanceof Error ? err.message : "No se pudo cargar el doctor.")
      )
      .finally(() => setLoadingDoctor(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matricula]);

  useEffect(() => {
    if (!matricula) return;
    let cancelado = false;
    setLoadingSlots(true);
    setErrorSlots(null);
    getDisponibilidadDoctor(matriculaNum, fecha)
      .then((disponibles) => {
        if (cancelado) return;
        setSlots(disponibles);
        const pendiente = leerReservaPendiente(location.pathname);
        if (!estaAutenticado || !pendiente || pendiente.fecha !== fecha) return;
        if (pendiente.doctorId === matriculaNum && Date.parse(pendiente.horario) > Date.now()
          && disponibles.includes(pendiente.horario)) {
          setSlotElegido(pendiente.horario);
          setObraSocialId(pendiente.obraSocialId);
        } else {
          borrarReservaPendiente();
          setErrorSlots('El horario que elegiste ya no está disponible. Elegí otro horario.');
        }
      })
      .catch((err) => {
        if (!cancelado) setErrorSlots(err instanceof Error ? err.message : "No se pudo obtener la disponibilidad.");
      })
      .finally(() => { if (!cancelado) setLoadingSlots(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matricula, fecha, estaAutenticado]);

  useEffect(() => {
    setCargandoObrasSociales(true);
    getObrasSociales()
      .then(setObrasSociales)
      .catch(() => setObrasSociales([]))
      .finally(() => setCargandoObrasSociales(false));
  }, []);

  const cargarMesDisponible = (anio: number, mes: number) => {
    if (!matricula) return;
    getDisponibilidadMesDoctor(matriculaNum, anio, mes)
      .then((fechas) => setFechasConTurnos(new Set(fechas)))
      .catch(() => {});
  };

  const elegirSlot = (slot: string) => {
    guardarReservaPendiente({ ruta: location.pathname, fecha, doctorId: matriculaNum, horario: slot, obraSocialId: '' });
    if (!estaAutenticado) {
      navigate("/registro", {
        state: { from: location.pathname, mensaje: "Creá una cuenta para reservar un turno." },
      });
      return;
    }
    setSlotElegido(slot);
    setErrorReserva(null);
    setObraSocialId("");
  };

  const confirmarReserva = async () => {
    if (!slotElegido || obraSocialId === "" || reservando || confirmado) return;
    guardarReservaPendiente({ ruta: location.pathname, fecha, doctorId: matriculaNum, horario: slotElegido, obraSocialId });
    setReservando(true);
    setErrorReserva(null);
    try {
      await reservarTurno(
        matriculaNum,
        slotElegido,
        obraSocialId === "sin-obra-social" ? null : obraSocialId
      );
      borrarReservaPendiente();
      setConfirmado(true);
    } catch (err) {
      setErrorReserva(err instanceof Error ? err.message : "No se pudo reservar el turno.");
      const disponibles = await getDisponibilidadDoctor(matriculaNum, fecha).catch(() => null);
      if (disponibles) {
        setSlots(disponibles);
        if (!disponibles.includes(slotElegido)) {
          setSlotElegido(null);
          borrarReservaPendiente();
          setErrorSlots('El horario que elegiste ya no está disponible. Elegí otro horario.');
        }
      }
    } finally {
      setReservando(false);
    }
  };

  if (loadingDoctor) {
    return (
      <Container maxWidth="md" sx={{ py: 6, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  if (errorDoctor || !doctor) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{errorDoctor ?? "Doctor no encontrado."}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <EncabezadoPagina><Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar src={doctor.foto ?? undefined} alt={`${doctor.nombre} ${doctor.apellido}`} sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
            <PersonIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" component="h1">
               Dr./Dra. {doctor.nombre} {doctor.apellido}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Matrícula {doctor.matricula}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              {doctor.especialidades?.map((esp) => (
                <Chip
                  key={esp.idEspecialidad}
                  label={esp.descripcionEsp}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        </Stack></EncabezadoPagina>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Reservá tu turno
        </Typography>

        <Typography color="text.secondary" sx={{ mb: 3 }}>Elegí un día y después un horario.</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "380px minmax(0, 1fr)" }, gap: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <TituloSeccion icono={<CalendarMonthOutlined />}>1. Elegí una fecha</TituloSeccion>
            <CalendarioTurnos
              fecha={fecha}
              onCambiarFecha={(nuevaFecha) => { if (nuevaFecha === fecha) return; borrarReservaPendiente(); setFecha(nuevaFecha); setSlotElegido(null); setLoadingSlots(true); }}
              fechasConTurnos={fechasConTurnos}
              onCambiarMes={cargarMesDisponible}
            />
          </Box>
          <Box sx={{ minWidth: 0, borderLeft: { md: 1 }, borderColor: { md: "divider" }, pl: { md: 3 } }}>
            <TituloSeccion icono={<AccessTimeOutlined />}>2. Elegí un horario</TituloSeccion>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </Typography>

            {errorSlots && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorSlots}
              </Alert>
            )}

            {loadingSlots ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : slots.length === 0 ? (
              <Alert severity="info">No hay horarios disponibles para esta fecha.</Alert>
            ) : (
              <HorariosPorFranja key={fecha} horarios={slots} onContinuar={elegirSlot} />
            )}
          </Box>
        </Box>
      </Paper>

      {doctor && slotElegido && <ConfirmacionTurno
        doctor={doctor} horario={slotElegido} obrasSociales={obrasSociales} obraSocialId={obraSocialId}
        cargandoObrasSociales={cargandoObrasSociales} reservando={reservando} confirmado={confirmado} error={errorReserva}
        onObraSocial={(seleccion) => {
          setObraSocialId(seleccion);
          guardarReservaPendiente({ ruta: location.pathname, fecha, doctorId: doctor.matricula, horario: slotElegido, obraSocialId: seleccion });
        }}
        onConfirmar={confirmarReserva}
        onCancelar={() => { borrarReservaPendiente(); setSlotElegido(null); }}
      />}
    </Container>
  );
}

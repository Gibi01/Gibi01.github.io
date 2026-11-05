// src/Componentes/CalendarioTurnos.tsx
// Los días disponibles tienen borde; los deshabilitados quedan atenuados.
import { useEffect, useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { StaticDatePicker } from "@mui/x-date-pickers/StaticDatePicker";
import { PickerDay, type PickerDayProps } from "@mui/x-date-pickers/PickerDay";
import { Box, Typography } from '@mui/material';

// El estado seleccionado conserva el relleno del color principal del tema.
function DiaCalendario(props: PickerDayProps) {
  const esDiaDisponible = !props.disabled && !props.selected && !props.outsideCurrentMonth;

  return (
    <PickerDay
      {...props}
      sx={
        props.disabled && !props.outsideCurrentMonth
          ? { '&.Mui-disabled': { bgcolor: 'transparent', color: 'text.disabled' } }
          : esDiaDisponible
            ? {
                border: 2,
                borderColor: "primary.main",
                color: "primary.main",
                "&:hover": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                },
              }
            : undefined
      }
    />
  );
}

interface Props {
  fecha: string; // YYYY-MM-DD
  onCambiarFecha: (fecha: string) => void;
  fechasConTurnos: Set<string>;
  onCambiarMes: (anio: number, mes: number) => void;
}

export default function CalendarioTurnos({
  fecha,
  onCambiarFecha,
  fechasConTurnos,
  onCambiarMes,
}: Props) {
  const hoy = dayjs().startOf("day");
  // MUI vuelve al mes seleccionado cuando cambia la referencia de value.
  const valor = useMemo(() => dayjs(fecha), [fecha]);

  useEffect(() => {
    onCambiarMes(valor.year(), valor.month() + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
    <StaticDatePicker
      sx={{ width: '100%', minWidth: 0, '& .MuiDateCalendar-root': { width: '100%', maxWidth: 340 },
        '& .MuiPickersSlideTransition-root': { minHeight: 260 },
        '& .MuiDayCalendar-weekDayLabel': { width: 'calc(100% / 7)', margin: 0 },
        '& .MuiDayCalendar-weekContainer': { justifyContent: 'space-around' },
        '& .MuiPickerDay-root': { width: 'min(40px, 12%)', height: 40, margin: 0 },
      }}
      value={valor}
      onChange={(nuevaFecha: Dayjs | null) => {
        if (nuevaFecha) onCambiarFecha(nuevaFecha.format("YYYY-MM-DD"));
      }}
      onMonthChange={(mes: Dayjs) => onCambiarMes(mes.year(), mes.month() + 1)}
      displayStaticWrapperAs="desktop"
      minDate={hoy}
      shouldDisableDate={(dia: Dayjs) =>
        dia.isBefore(hoy, "day") || !fechasConTurnos.has(dia.format("YYYY-MM-DD"))
      }
      slots={{ day: DiaCalendario }}
      slotProps={{ actionBar: { actions: [] } }}
    />
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
      Con borde: disponible · Relleno: seleccionado · Gris: sin turnos
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      Los horarios se muestran en el día en que comienza cada turno, aunque la atención continúe después de medianoche.
    </Typography>
    </Box>
  );
}

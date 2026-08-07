"""Tests unitarios del cálculo de ADR-005 (calificacion_final, estatus) --
sin BD, sin fixtures de Postgres: prueban directamente las funciones
puras de app/domains/control_escolar/service.py, como anticipan las
consecuencias de ADR-005 ("requiere tests unitarios explícitos del
cálculo: promedio simple, manejo de parciales nulos/pendientes,
redondeo").
"""

from app.domains.control_escolar.service import (
    UMBRAL_APROBADO,
    _calificacion_final,
    _estatus,
)


# --- calificacion_final: promedio simple ----------------------------------


def test_calificacion_final_promedio_simple_los_tres_parciales():
    assert _calificacion_final(8, 7, 9) == 8.0


def test_calificacion_final_promedio_con_decimales():
    # 20.5 / 3 = 6.8333... -> 6.8
    assert _calificacion_final(6.5, 7.0, 7.0) == 6.8


# --- calificacion_final: parciales nulos / pendientes ----------------------


def test_calificacion_final_none_con_los_tres_parciales_faltantes():
    assert _calificacion_final(None, None, None) is None


def test_calificacion_final_promedia_solo_los_parciales_disponibles_uno():
    assert _calificacion_final(5, None, None) == 5.0


def test_calificacion_final_promedia_solo_los_parciales_disponibles_dos():
    assert _calificacion_final(8, None, 6) == 7.0


def test_calificacion_final_todos_presentes_no_es_caso_especial():
    # Con los 3 presentes, el resultado es el promedio de los 3 -- no hay
    # tratamiento distinto al de "parciales disponibles" con menos de 3.
    assert _calificacion_final(10, 10, 10) == 10.0


# --- calificacion_final: redondeo -------------------------------------------


def test_calificacion_final_redondea_a_un_decimal():
    # 22 / 3 = 7.333... -> 7.3 (DECIMAL(4,1) en BD, un solo decimal)
    assert _calificacion_final(6, 7, 9) == 7.3


def test_calificacion_final_redondea_periodico_hacia_arriba():
    # 26 / 3 = 8.666... -> 8.7
    assert _calificacion_final(8, 9, 9) == 8.7


# --- estatus: derivado de calificacion_final con el umbral asumido ---------


def test_estatus_pendiente_cuando_calificacion_final_es_none():
    assert _estatus(None) == "pendiente"


def test_estatus_aprobado_en_el_umbral_exacto():
    assert UMBRAL_APROBADO == 6
    assert _estatus(6.0) == "aprobado"


def test_estatus_reprobado_justo_debajo_del_umbral():
    assert _estatus(5.9) == "reprobado"


def test_estatus_aprobado_por_encima_del_umbral():
    assert _estatus(8.5) == "aprobado"


def test_estatus_reprobado_calificacion_minima():
    assert _estatus(0.0) == "reprobado"


def test_estatus_aprobado_calificacion_maxima():
    assert _estatus(10.0) == "aprobado"

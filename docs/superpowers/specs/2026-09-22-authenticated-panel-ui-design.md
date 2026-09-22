# Diseño del panel autenticado Empyra

## Objetivo

Transformar el área autenticada de Empyra en una experiencia operativa profesional y coherente: dashboard, facturas, clientes, productos y configuración. La interfaz debe mejorar la lectura, los flujos de acción y la respuesta del sistema sin modificar reglas fiscales ni contratos de API.

## Alcance

- Shell autenticado responsive con navegación lateral y móvil.
- Dashboard, listas, filtros, estados vacíos, páginas de detalle y configuración.
- Formularios de creación y edición en diálogo o panel lateral, no incrustados en la página.
- Confirmación explícita antes de acciones que crean, guardan, emiten, anulan, eliminan o cierran sesión.
- Toasts accesibles para éxito, error e información transitoria.
- Documento final de cambios y verificación.

## Dirección visual

Se conserva la identidad azul/verde existente. El nuevo sistema usa azul para acciones primarias y foco, verde para estados correctos/fiscales aceptados, ámbar para pendientes y rojo solo para error o acción destructiva. Fondos neutros claros, superficie blanca, bordes suaves y tipografía sobria mejoran el contraste y la jerarquía sin convertir el panel en una página de marketing.

La interfaz está en modo **Operate**: información escaneable, acciones predecibles y densidad adecuada para trabajo diario. El valor visual aparece en la composición, los espacios, la jerarquía y los microestados, no en decoración superflua.

## Sistema de interfaz

### Shell

- Sidebar de escritorio fija y compacta, con marca/tenant, navegación con icono y etiqueta, estado activo inequívoco y cierre de sesión separado.
- Barra superior móvil con menú, contexto de página y acción prioritaria.
- Contenido centrado con ancho máximo, espaciado consistente y cabecera por página.

### Componentes reutilizables

- `AppShell`, `PageHeader`, `MetricCard`, `DataToolbar`, `FilterChip`, `EmptyState`, `StatusBadge`, `DataTable`, `Dialog`, `ConfirmDialog`, `ToastProvider` y `ToastViewport`.
- Controles con etiquetas visibles, foco claro, objetivos táctiles de al menos 44 px y estados disabled/loading explícitos.
- Filtros como toolbar compacta: búsqueda, chips de estado y acción para limpiar; en móvil se agrupan en un diálogo de filtros.

### Flujos

- Crear/editar cliente o producto abre un panel lateral o diálogo con validación accesible.
- Guardar solicita confirmación solo cuando es una operación fiscal o modifica datos ya existentes; la creación simple confirma el envío mediante toast para no añadir pasos innecesarios.
- Emisión, anulación, borrado, cambio de estado y cierre de sesión siempre usan `ConfirmDialog` con una descripción del efecto.
- Resultados de API, errores de red y acciones correctas se comunican mediante toasts; los formularios conservan errores de campo junto al control correspondiente por accesibilidad.

## Pantallas

### Dashboard

Cuatro KPI con icono y lectura inmediata, sección de documentos recientes con tabla compacta y estado vacío orientado a la primera factura. Los accesos rápidos son secundarios a la acción “Nueva factura”.

### Facturas

Cabecera con total y acción primaria, toolbar con búsqueda/filtro de estado, tabla con cliente, número, fecha, total y badge fiscal. El vacío explica cómo comenzar. Las acciones por fila abren menú y confirmación cuando su efecto es irreversible.

### Clientes y productos

Misma estructura para reducir aprendizaje: toolbar, tabla/lista, contador, estado vacío y botón de alta. Crear/editar ocurre en diálogo, no como formulario inline.

### Configuración

Agrupa empresa y DIAN en tarjetas claras. Las credenciales son secretas, aparecen enmascaradas y se editan en diálogo. Guardar configura una confirmación descriptiva y toast de resultado.

## Responsive y accesibilidad

- Desktop: sidebar visible y tablas completas.
- Tablet: contenido fluido y toolbar que puede envolver sin perder acciones.
- Móvil: sidebar como drawer, métricas a una columna, tablas con filas resumidas, filtros en diálogo y diálogos a pantalla completa cuando sea necesario.
- Navegación por teclado, gestión de foco al abrir/cerrar diálogos, Escape, `aria-live` para toasts, contraste WCAG AA y respeto de `prefers-reduced-motion`.

## Verificación

- Pruebas unitarias de componentes de diálogo, confirmación y toast.
- Pruebas E2E de navegación, filtros, alta/edición en diálogo, confirmación y feedback.
- Revisión visual a 1440 px y 390 px; sin overflow, controles inaccesibles ni estados vacíos ambiguos.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, E2E web y build.

## Fuera de alcance

- Cambio de paleta o identidad de marca.
- Cambios de contratos API, permisos, reglas fiscales o esquema de base de datos.
- Nuevas funciones de negocio fuera de las pantallas existentes.

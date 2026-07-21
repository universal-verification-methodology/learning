# Legacy combined courses (ignored)

These trees are **legacy / pre–pass-3** combined repos. They are kept in the monorepo for history and occasional Track A fidelity peeks, but they are **not** part of the active 18-course product path.

**Do not** extend modules, run module-slides, or treat them as catalog courses.

| Legacy path | Use instead (pass 3) |
|-------------|----------------------|
| `learn_unix_git` | `learn_unix` · `learn_git` |
| `learn_digital_verilog` | `learn_digital` · `learn_verilog` |
| `learn_verilog_systemverilog` | `learn_verilog` · `learn_systemverilog` |
| `learn_verilator_iverilog` | `learn_verilator` · `learn_iverilog` |
| `learn_uart_spi_i2c` | `learn_uart` · `learn_spi` · `learn_i2c` |
| `learn_uvm2017_sv_verilator` | `learn_uvm2017` · `learn_systemverilog` · `learn_verilator` |
| `learn_uvm_pyuvm` | `learn_pyuvm` · (`learn_cocotb` / `learn_python_hw` for cocotb on-ramp) |
| `verification_planning_management` | `learn_verification_planning_management` |

**Not needed as a new course:** there is no `learn_sv_verilator`. SV design is `learn_systemverilog`; the simulator tool path is `learn_verilator` (and `learn_iverilog` / `learn_hdl_simulator` as needed). The old combined tree was `learn_uvm2017_sv_verilator` (already ignored).

Active catalog and GitHub Pages courses live under the **`learn_*`** pass-3 ids listed in [`../syllabus.md`](../syllabus.md) and [`../platform/assets/catalog.json`](../platform/assets/catalog.json).

Agent ignore list: [`.cursorignore`](../.cursorignore).

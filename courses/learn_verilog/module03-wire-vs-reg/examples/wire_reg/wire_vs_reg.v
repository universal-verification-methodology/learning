// wire_vs_reg.v — assign-driven net vs always-driven variable
module wire_reg_demo(
  input  a,
  input  b,
  output y_net,
  output reg y_var
);
  assign y_net = a & b;
  always @(*) y_var = a & b;
endmodule

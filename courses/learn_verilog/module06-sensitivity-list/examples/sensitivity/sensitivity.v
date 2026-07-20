// sensitivity.v — combo list vs clock edge
module sens_demo(
  input      A,
  input      B,
  input      clk,
  input      D,
  output reg Y,
  output reg Q
);
  always @(A or B)
    Y = A & B;

  always @(posedge clk)
    Q <= D;
endmodule

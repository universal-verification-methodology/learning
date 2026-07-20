// blocking_nba.v — sequential style uses non-blocking
module ff_nba(
  input      clk,
  input      D,
  output reg Q
);
  always @(posedge clk)
    Q <= D;
endmodule

module pipe_nba(
  input      clk,
  input      D,
  output reg q1,
  output reg q2
);
  always @(posedge clk) begin
    q1 <= D;
    q2 <= q1;  // old q1 — true pipeline delay
  end
endmodule

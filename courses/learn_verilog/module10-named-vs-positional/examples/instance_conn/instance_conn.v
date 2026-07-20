// instance_conn.v — prefer named port connections
module dff(
  input      clk,
  input      d,
  output reg q
);
  always @(posedge clk)
    q <= d;
endmodule

module top(
  input  clk,
  input  din,
  output qout
);
  dff u_good (
    .clk(clk),
    .d  (din),
    .q  (qout)
  );
  // dff u_bad(clk, qout, din);  // positional swap — compiles, miswired
endmodule

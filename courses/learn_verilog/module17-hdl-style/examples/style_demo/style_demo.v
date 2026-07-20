// style_demo.v - conventional naming and block style
module ff_styled(
  input        clk,
  input        rst_n,
  input        d,
  output reg   q
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end
endmodule

module and2_styled(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule

// clock_bad - style warnings (commented)
// module clock_bad(input clock, d, output reg q);
//   always @(posedge clock) q <= d;
// endmodule

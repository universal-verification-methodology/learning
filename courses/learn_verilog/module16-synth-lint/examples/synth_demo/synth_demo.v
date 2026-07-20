// synth_demo.v - clean RTL vs common lint violations
module and2_clean(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule

module ff_good(
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

// delay_bad - NOT synthesizable (commented)
// module delay_bad(input a, output y);
//   assign #5 y = a;
// endmodule

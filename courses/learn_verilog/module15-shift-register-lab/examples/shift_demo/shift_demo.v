// shift_demo.v - SIPO and PISO shift registers
module sipo8(
  input        clk,
  input        rst,
  input        si,
  output reg [7:0] q
);
  always @(posedge clk) begin
    if (rst) q <= 8'd0;
    else     q <= {q[6:0], si};
  end
endmodule

module piso8(
  input        clk,
  input        rst,
  input        load,
  input  [7:0] d,
  output reg   so,
  output reg [7:0] shreg
);
  always @(posedge clk) begin
    if (rst)       shreg <= 8'd0;
    else if (load) shreg <= d;
    else           shreg <= {1'b0, shreg[7:1]};
  end
  always @(posedge clk)
    so <= shreg[0];
endmodule

// generate_demo.v - replication + generate for
module leaf_cell(
  input  d,
  output q
);
  assign q = d;
endmodule

module generate_demo #(
  parameter N = 4
)(
  input  [N-1:0] d,
  output [N-1:0] q
);
  wire [N-1:0] ones;
  assign ones = {N{1'b1}};

  genvar i;
  generate
    for (i = 0; i < N; i = i + 1) begin : bit_cell
      leaf_cell u (.d(d[i]), .q(q[i]));
    end
  endgenerate
endmodule

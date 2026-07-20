// one_driver.v - one structural driver
module mux_one_driver(
  input  sel,
  input  a,
  input  b,
  output y
);
  assign y = sel ? b : a;
endmodule

// fight_bad - two assigns (commented; sim -> X)
// module fight_bad(output wire net);
//   assign net = 1'b1;
//   assign net = 1'b0;
// endmodule

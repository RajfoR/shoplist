import { matchRoute, paths } from "../src/lib/router";

test.each([
  ["/", { name: "lists" }],
  ["/lists/abc-123", { name: "list", id: "abc-123" }],
  ["/lists/abc-123/", { name: "list", id: "abc-123" }],
  ["/join/k3J9_x-Q", { name: "join", token: "k3J9_x-Q" }],
  ["/lists", { name: "notFound" }],
  ["/lists/a/b", { name: "notFound" }],
  ["/cokolwiek", { name: "notFound" }],
])("%s", (path, expected) => {
  expect(matchRoute(path)).toEqual(expected);
});

test("paths i matchRoute są odwrotnościami (z kodowaniem znaków)", () => {
  expect(matchRoute(paths.join("a/b c"))).toEqual({ name: "join", token: "a/b c" });
  expect(matchRoute(paths.list("x?y"))).toEqual({ name: "list", id: "x?y" });
});

## Variable and function naming

In frontend projects (svelte, .ts and .js files as well as tests), always use snake_case instead of the default camelCase for variable names and function names.
Also do not use semicolons at the end of a line.

## Javascript and typescript functions

For functions in javascript and typescript code, use arrow functions instead of `function my_func()`.

## Prefer type over interface

In typescript prefer types, e.g.

```
type Person = {
  name: string
  age: number
}
```

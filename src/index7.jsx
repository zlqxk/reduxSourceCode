function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}

function func1 (arg) {
  return arg + 1
}
function func2 (arg) {
  return arg + 1
}
function func3 (arg) {
  return arg + 1
}
const res = func1(func2(func3(1)));
console.log(res, 'res') // 4

const composeFun = compose(func1, func2, func3);
const res2 = composeFun(1)
console.log(res2, 'res2') // 4
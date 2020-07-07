import { createStore, combineReducers } from "redux";

const initState = {
  count: 0,
  count2: 0
}

const handleData = (state, type) => {
  // state = Object.assign({}, state, {
  //   [type]: state[type] + 1
  // })
  // return state
  // 或者使用展开运算符
  return {...state, [type]:state[type] + 1}
}

function counter(state = initState, action) {
  switch (action.type) {
    case "INCREMENT":
      return handleData(state, 'count');
    default:
      return state;
  }
}

function counter2(state = initState, action) {
  switch (action.type) {
    case "INCREMENT2":
      return handleData(state, 'count2');
    default:
      return state;
  }
}

const rootReducer = combineReducers({
  counter,
  counter2
})

const store = createStore(rootReducer);

store.dispatch({ type: "INCREMENT" });
const a = store.getState()
store.dispatch({ type: "INCREMENT" });
const b = store.getState()
store.dispatch({ type: "INCREMENT2" });
const c = store.getState()
store.dispatch({ type: "INCREMENT2" });
const d = store.getState()

console.log(a, 'a');
console.log(b, 'b');
console.log(c, 'b');
console.log(d, 'd');


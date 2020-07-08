import { createStore } from "redux";
import { fromJS } from 'immutable';
import { combineReducers } from 'redux-immutable';

const count = {
  num:0
}

const count2 = {
  num2:0
}



// 使用formJS来将js对象转换为immutable对象
function counter(state = fromJS(count), action) {
  switch (action.type) {
    case "INCREMENT":
      return state.set('num', state.get('num') + 1)
    default:
      return state;
  }
}

function counter2(state = fromJS(count2), action) {
  switch (action.type) {
    case "INCREMENT2":
      return state.set('num2', state.get('num2') + 1)
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
const a = store.getState().getIn(['counter', 'num'])
store.dispatch({ type: "INCREMENT" });
const b = store.getState().getIn(['counter', 'num'])
store.dispatch({ type: "INCREMENT2" });
const c = store.getState().getIn(['counter2', 'num2'])
store.dispatch({ type: "INCREMENT2" });
const d = store.getState().getIn(['counter2', 'num2'])

console.log(a, 'a'); // 1
console.log(b, 'b'); // 2
console.log(c, 'c'); // 1
console.log(d, 'd'); // 2



## 本文将由浅到深介绍redux及其辅助工具（react-redux、redux-saga、redux-thunk）的使用及其原理，想写这篇文章很久了，今天终于抽出时间来记录一下，小伙伴们准备好了吗，发车！

## 首先一个很大的误区就是redux是专门给react使用的，其实在原生js或者vue中，redux都是可以发挥他的作用

## 1、先用官网的例子来介绍下redux的最基本的使用（使用在原生js中）
> ### 注： 在阅读时，请先摒弃之前的使用习惯，不要去思考react-redux，dva，saga等用法，这些辅助工具都是对redux进行了二次的封装，过度纠结辅助工具的语法只会让你对redux源码更加纠结，所以请先抛弃之前的使用语法，我们就从最原始的redux语法开始讲起
``` js
  //    ./src/index.jsx
  import { createStore } from "redux";

  // 创建reducer
  function counter(state = 0, action) {
    switch (action.type) {
      case "INCREMENT":
        return state + 1;
      case "DECREMENT":
        return state - 1;
      default:
        return state;
    }
  }

  // 传入创建的reducer并创建store
  const store = createStore(counter);

  // 手动订阅更新 (当dispatch时将会执行回调函数)
  store.subscribe(() =>
    // getState() 用来获取最新的state
    console.log(store.getState())
  );

  /**
   * 派发action，每次派发action都会在reducer中进行匹配，然后返回对应的state
   * 在上面我们已经手动订阅了更新，所以每次派发action时，都会触发store.subscribe回调函数，然后将最新的state打印出来
   */
  store.dispatch({ type: "INCREMENT" });
  store.dispatch({ type: "INCREMENT" });
  store.dispatch({ type: "INCREMENT" });

```
## 短短几行代码就可以实现redux的基本功能，那上面的例子中都用到了那几个api呢，有创建store的createStore，和挂载在store上的订阅subscribe，派发action的dispatch，获取最新状态的getState，那我们就先看下这几个是怎么实现的（可以直接在node_module中找到redux源码文件中的es文件夹下redux.js去debugger）
___

## 那我们就先看看createStore到底有什么玄机，由于createStore源码较长，我把他拆成几部分一点一点看
> ## 我们可以看到createStore接收三个参数，我们上面的例子只传入了第一个参数reducer，第二个参数preloadedState是初始化状态，第三个参数enhancer是用来使用中间件
``` js
  export default function createStore(reducer, preloadedState, enhancer) {
    // 一些类型判断。。。
    if (
      (typeof preloadedState === 'function' && typeof enhancer === 'function') ||
      (typeof enhancer === 'function' && typeof arguments[3] === 'function')
    ) {
      throw new Error(
        'It looks like you are passing several store enhancers to ' +
          'createStore(). This is not supported. Instead, compose them ' +
          'together to a single function.'
      )
    }
    /** 
     * 如果第二个参数传入的是一个函数，并且没有传入第三个参数，则把第二个参数赋值给第三个参数
     * 正是因为这样我们才可以这样写 createStore（reducer, applymiddleware(thunk))，直接省略
     * 第二个参数preloadedState
    */
    if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
      enhancer = preloadedState
      preloadedState = undefined
    }

    // 一些类型判断
    if (typeof enhancer !== 'undefined') {
      if (typeof enhancer !== 'function') {
        throw new Error('Expected the enhancer to be a function.')
      }
      // 返回中间件，这个属于redux高级，在讲中间件的部分我们重点讲
      return enhancer(createStore)(reducer, preloadedState)
    }

    if (typeof reducer !== 'function') {
      throw new Error('Expected the reducer to be a function.')
    }    
    
    let currentReducer = reducer // 传入的reducer
    let currentState = preloadedState // 传入的preloadedState，通常为undefined
    let currentListeners = [] // 创建一个用来存放subscribe的数组，因为可以声明多个subscribe, 所以使用一个数组来维护
    let nextListeners = currentListeners // 最新的存放订阅的数组
    let isDispatching = false // 一个标志，用来判断是否是派发阶段，在同一时间里，只能触发一次action，如果同一时间触发了两个actoin，那数据就会紊乱，所以通过这个锁来控制同一时间只能触发一次action

    /** 
     * 用来确保nextListeners和currentListeners不是一个引用
     * 用来保证以下这种情况时能正常运行，所以通过nextListeners和currentListeners共同维护订阅数组
      store.subscribe(() => {
        // getState() 用来获取最新的state
        console.log(store.getState())
        store.subscribe(() => {
          // getState() 用来获取最新的state
          console.log(store.getState(), '2')
        });
      });
    */
    function ensureCanMutateNextListeners() {
      if (nextListeners === currentListeners) {
        nextListeners = currentListeners.slice()
      }
    }

    /**
     * getState用来返回最新的状态，在上述的例子中我们正是在订阅的回调中调用了这个方法来打印最新的状态
     * 那返回的这个currentState是什么时候改变呢，在后面的dispatch里我们会讲到
     */
    function getState() {
      if (isDispatching) {
        throw new Error(
          'You may not call store.getState() while the reducer is executing. ' +
            'The reducer has already received the state as an argument. ' +
            'Pass it down from the top reducer instead of reading it from the store.'
        )
      }

      return currentState
    }
  }
```
>## 紧接上文，下面介绍createStore中的subscribe是怎么实现的
```js
  // 可以看到这个subscribe这个方法只接受一个参数，我们上面的的例子传入了一个回调函数来打印最新的状态
  // 再回忆下我们当时怎么使用的
  // store.subscribe(() =>
  //   console.log(store.getState())
  // );
  function subscribe(listener) {
    // 只允许接受函数
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function.')
    }

    // 在reducer执行过程中不能执行订阅
    if (isDispatching) {
      throw new Error(
        'You may not call store.subscribe() while the reducer is executing. ' +
          'If you would like to be notified after the store has been updated, subscribe from a ' +
          'component and invoke store.getState() in the callback to access the latest state. ' +
          'See https://redux.js.org/api-reference/store#subscribelistener for more details.'
      )
    }

    let isSubscribed = true
    
    // 用来确保nextListeners和currentListeners不是一个引用
    ensureCanMutateNextListeners()
    /** 
     * 将我们传入的回调函数push到nextListeners这个数组里，这样后续我们dispatch的时候就可以在这个数组里遍历
     * 找到我们的回调函数，然后执行它
     * 可以订阅多次，所以用一个数组来维护
      store.subscribe(() =>
        console.log(store.getState(), ’第一个订阅‘)
      );
      store.subscribe(() =>
        console.log(store.getState() + 1， ’第二个订阅‘)
      );
    */
    nextListeners.push(listener)

    // 返回一个用来卸载订阅的函数
    // store.subscribe(() =>
    //   console.log(store.getState())
    // )();
    // 这样就可以卸载订阅
    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      if (isDispatching) {
        throw new Error(
          'You may not unsubscribe from a store listener while the reducer is executing. ' +
            'See https://redux.js.org/api-reference/store#subscribelistener for more details.'
        )
      }

      isSubscribed = false
      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
      currentListeners = null
    }
  }
```
> ## 紧接上文我们介绍下dispatch是如何实现派发action的
```js
  /** 
   * 回忆下我们当时是怎么使用的
   * store.dispatch({ type: "INCREMENT" })
   * dispatch只接受一个参数actino，其中规范约定是一个包含type的对象
  */
  function dispatch(action) {
    /** 
     * 该函数的作用是用来判断传入的acion是不是一个简单对象
     * 简单对象：new Object 或者 {} 声明的对象
     * isPlainObject({}) // true
     * class Per {}
     * var p = new Per()
     * isPlainObject(p) // false
      function isPlainObject(obj) {
        if (typeof obj !== 'object' || obj === null) return false

        let proto = obj
        while (Object.getPrototypeOf(proto) !== null) {
          proto = Object.getPrototypeOf(proto)
        }

        return Object.getPrototypeOf(obj) === proto
      }
    */
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
          'Use custom middleware for async actions.'
      )
    }
    // 判断是否有type来约束派发的acion必须包含type属性
    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          'Have you misspelled a constant?'
      )
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    /** 
     * 这里是精髓了！
     * currentReducer在上文中定义：let currentReducer = reducer，也就是我们创建store时传入的reducer
     * 例子中我们传入的reducer:
      function counter(state = 0, action) {
        switch (action.type) {
          case "INCREMENT":
            return state + 1;
          case "DECREMENT":
            return state - 1;
          default:
            return state;
        }
      }
    */
    try {
      isDispatching = true
      /** 
       * @params currentState就是state = 0
       * @params action = { type: "INCREMENT" }
       * 然后返回新的state给currentState
       * 还记不记得getState()这个函数，不记得话去上面看一下，getState()这个函数的返回值正是currentState
       * 所以实现了每次派发一个action改变了state，然后通过getState()就能拿到最新的state
      */
      currentState = currentReducer(currentState, action)
    } finally {
      isDispatching = false
    }

    /** 
     * 为什么每当我们执行store.dispatch({ type: "INCREMENT" })，subscribe订阅的回调函数都会自动执行呢
     * 正是因为在subscribe这个函数里我们将要订阅的回调函数push到了nextListeners这个数组里
     * 然后再这里我们就可以遍历nextListeners这个数组来执行我们订阅的回调函数
      store.subscribe(() =>
        console.log(store.getState())
      );
      store.dispatch({ type: "INCREMENT" })
    */
    const listeners = (currentListeners = nextListeners)
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action
  }
```
***
> ## 以上就是createStore的核心部分，createStore里最后还有两个不常用的函数，这里贴出来大体解释下

```js
  // 通过条件判断之后，以达到替换reducer效果
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    currentReducer = nextReducer

    // This action has a similiar effect to ActionTypes.INIT.
    // Any reducers that existed in both the new and old rootReducer
    // will receive the previous state. This effectively populates
    // the new state tree with any relevant data from the old one.
    dispatch({ type: ActionTypes.REPLACE })
  }
```
```js
  // 这个函数是用来给开发者使用的，我们无法使用而且不需要掌握
  function observable() {
    const outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== 'object' || observer === null) {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }
```
> ## 再createStore的结尾将这些方法暴露出来，这样我们就可以通过store.xxx来调用了
```js
  // 这里redux默认派发了一个action用来初始化stateTree，个人感觉没啥luan用 --！
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
```




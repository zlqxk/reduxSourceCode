## 本文将由浅到深介绍redux及其辅助工具（react-redux、redux-saga、redux-thunk）的使用及其原理，想写这篇文章很久了，今天终于抽出时间来记录一下，小伙伴们准备好了吗，发车！

## 首先一个很大的误区就是redux是专门给react使用的，其实在原生js或者vue中，redux都是可以发挥他的作用

## 1、先用官网的例子来介绍下redux的最基本的使用（使用在原生js中）
> ### 注： 在阅读时，请先摒弃之前的使用习惯，不要去思考react-redux，dva，saga等用法，过度纠结辅助工具的语法只会让你对redux源码更加纠结，所以请先抛弃之前的使用语法，我们就从最原始的redux语法开始讲起
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
### 短短几行代码就可以实现redux的基本功能，那上面的例子中都用到了哪几个api呢，有创建store的createStore，和挂载在store上的订阅subscribe，派发action的dispatch，获取最新状态的getState，那我们就先看下这几个是怎么实现的（可以直接在node_module中找到redux源码文件中的es文件夹下redux.js去debugger）
___

### 那我们就先看看createStore到底有什么玄机，由于createStore源码较长，我把他拆成几部分一点一点看
> ### 我们可以看到createStore接收三个参数，我们上面的例子只传入了第一个参数reducer。第二个参数是preloadedState是初始化状态，第三个参数是enhancer，这个的作用是用来增强action的能力也就是所谓的中间件
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
      // 返回中间件，这个属于redux高级，在讲中间件的部分我们重点讲，现在可以先忽略
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
     * console.log(store.getState())
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
>### 紧接上文，下面介绍createStore中的subscribe是怎么实现的
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
    // 这样就可以卸载订阅
    // store.subscribe(() =>
    //   console.log(store.getState())
    // )();
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
> ### 紧接上文我们介绍下dispatch是如何实现派发action的
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
       * @params currentState就是当前的状态，第一次是默认参数state = 0，后续都是返回的最新的状态
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
     * 然后在这里我们就可以遍历nextListeners这个数组来执行我们订阅的回调函数
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
> ### 以上就是createStore的核心部分，createStore里最后还有两个不常用的函数，这里贴出来大体解释下

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
> ### 在createStore的结尾将这些方法暴露出来，这样我们就可以通过store.xxx来调用了
```js
  // 这里redux默认派发了一个action用来初始化stateTree，ActionTypes.INIT这个其实就是一个随机的字符，用来触发reducer里的switch里的default的回调，返回初始化的状态，这次的dispatch不会触发订阅，因为订阅在store创建之后
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
```

***

> ### 以上就是最基础的redux使用及其源码，但是在我们的使用中，通常都是维护一个状态树，然后通过多个reducer来改变状态树，redux提供了combineReducers 这个api来帮助我们维护多个reducer，先让我们看下combineReducers 的使用

```js
  //   ./src/index2.jsx   提示：将webpack入口改为index2.jsx即可运行
  import { createStore, combineReducers } from "redux";

  // 创建多个reducer

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

  function counter2(state = 0, action) {
    switch (action.type) {
      case "INCREMENT2":
        return state + 1;
      case "DECREMENT2":
        return state - 1;
      default:
        return state;
    }
  }

  // 这里我们可以看到combineReducers方法接受一个对象为参数，对象的value正是每一个reducer
  const rootReducer = combineReducers({
    counter,
    counter2
  })

  // 传入创建的reducer并创建store
  const store = createStore(rootReducer);

  // 手动订阅更新 (当dispatch action 将会执行回调函数)
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

  store.dispatch({ type: "INCREMENT2" });
  store.dispatch({ type: "INCREMENT2" });
  store.dispatch({ type: "INCREMENT2" });
  // 输出的结果
  // {counter: 1, counter2: 0}
  // {counter: 2, counter2: 0}
  // {counter: 3, counter2: 0}
  // {counter: 3, counter2: 1}
  // {counter: 3, counter2: 2}
  // {counter: 3, counter2: 3}

```
### 上述的例子我们可以看到，createStore这个方法接收的是合并的rootReducer为参数，并且store.getState()返回的state变为了对象的形式{counter: 1, counter2: 0}，那combineReducers究竟做了什么，让我们来一探究竟！
```js
  // 参数reducers 为我们传入的 {counter: function counter, counter2: function counter2}
  function combineReducers(reducers) {
    // Object.keys方法返回对象的所有可枚举属性的数组
    // reducerKeys = [counter, counter2]
    const reducerKeys = Object.keys(reducers) 
    const finalReducers = {}
    for (let i = 0; i < reducerKeys.length; i++) {
      const key = reducerKeys[i]

      // 如果在开发环境，会有一个报错提示
      if (process.env.NODE_ENV !== 'production') {
        if (typeof reducers[key] === 'undefined') {
          warning(`No reducer provided for key "${key}"`)
        }
      }
      
      /** 
       * 这里其实就是一个筛选的过程，如果我们传入的reducers参数是这种格式
       * {
       *    counter: function counter
       *    counter2: function counter2
       *    counter3: undefined
       * }
       * 那么将会把counter3过滤掉，返回的finalReducers为 
       * 
       * {
       *    counter: function counter
       *    counter2: function counter2
       * }
      */
      if (typeof reducers[key] === 'function') {
        finalReducers[key] = reducers[key]
      }
    }
    /**
     *  得到最终的finalReducerKeys和finalReducers
     *  finalReducerKeys = ['counter', 'counter2']
     *  finalReducers = {
     *    counter: funtion counter,
     *    counter2: funtion counter2
     *  }
     */ 
    const finalReducerKeys = Object.keys(finalReducers)

    // This is used to make sure we don't warn about the same
    // keys multiple times.
    let unexpectedKeyCache
    if (process.env.NODE_ENV !== 'production') {
      unexpectedKeyCache = {}
    }

    // 这里是做一个类型判断，这个函数的解析在下方，可以先移步下方assertReducerShape的解析
    let shapeAssertionError
    try {
      assertReducerShape(finalReducers)
    } catch (e) {
      shapeAssertionError = e
    }

    /** 
     * 精髓来了，combineReducers在经历了一系列的判断后，最终会返回一个函数combination
      const rootReducer = combineReducers({
        counter,
        counter2
      })
      const store = createStore(rootReducer);
     * 然后我们再将这个函数传入createStore
     * 大家还记得createStore接受的第一个参数吗，在没有使用combineReducers之前传入的是单个的reducer
     * 在使用了之后传入的是combination
     * 回忆一下createStore中的dispatch函数
     * try {
        isDispatching = true
        currentState = currentReducer(currentState, action)
      } finally {
        isDispatching = false
      }
     * 现在的currentReducer正是combination
    */
    return function combination(state = {}, action) {
      // 结合上文的shapeAssertionError， 如果assertReducerShape里抛出了异常，那么在这里也会被阻塞
      if (shapeAssertionError) {
        throw shapeAssertionError
      }
      // 如果不是在生产环境下，做一些警告级别的错误
      if (process.env.NODE_ENV !== 'production') {
        // 这个函数的解析也在下方，可以先移步下方的getUnexpectedStateShapeWarningMessage解析
        const warningMessage = getUnexpectedStateShapeWarningMessage(
          state, // currentState
          finalReducers, // 多个reducer组成的对象
          action, // 传入的action
          unexpectedKeyCache
        )
        if (warningMessage) {
          warning(warningMessage)
        }
      }

      
      // 经过了一系列的判断以后，终于来到了精髓部分
      let hasChanged = false
      // 这个nextState就是最终返回值
      const nextState = {}
      // finalReducerKeys = ['counter', 'counter2']
      for (let i = 0; i < finalReducerKeys.length; i++) {
        // 为了方便大家理解，我们以i=0时刻为例，看一下每一个字段对应着什么
        const key = finalReducerKeys[i] // 'counter'
        const reducer = finalReducers[key] // function counter
        const previousStateForKey = state[key] // state就是currentState，现在是undefind
        // 执行function counter，并且将最新的state赋值给nextStateForKey
        const nextStateForKey = reducer(previousStateForKey, action)
        if (typeof nextStateForKey === 'undefined') {
          const errorMessage = getUndefinedStateErrorMessage(key, action)
          throw new Error(errorMessage)
        }
        /** 
         * 这个函数作用就是返回一段错误文案
         * 
        function getUndefinedStateErrorMessage(key, action) {
          const actionType = action && action.type
          const actionDescription =
            (actionType && `action "${String(actionType)}"`) || 'an action'

          return (
            `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
            `To ignore an action, you must explicitly return the previous state. ` +
            `If you want this reducer to hold no value, you can return null instead of undefined.`
          )
        }
        */

        // 将counter这次返回的最新的state赋值到nextState这个对象里，所以我们最后拿到的是{conuter: 1, counter: 2} 这种格式
        nextState[key] = nextStateForKey 
        // hasChanged的作用是用来判断最新的状态与上一次的状态有没有发生改变，如果发生改变则为true
        // 并且这里有一个短路操作，只要多个reducer其中有一个状态发生了改变，则hasChanged为true
        hasChanged = hasChanged || nextStateForKey !== previousStateForKey
      }
      // 如果所有的reducer都没有改变状态，则返回原来的状态，否则返回最新的状态
      // 这里就有疑问了，为什么要做这个判断，而不是直接返回最新的状态呢
      // 个人理解这里之所以要做这个判断，是因为在状态没有改变的情况，还是返回之前的引用，就不必再开辟新的引用来存储
      // 新的状态，只有状态发生改变，才去返回最新的引用
      hasChanged =
        hasChanged || finalReducerKeys.length !== Object.keys(state).length
      return hasChanged ? nextState : state
    }
  }
```
> ### assertReducerShape解析，主要作用是保证你的reducer都是正常可运行的
```js
  // 入参reducers为
  // {
  //   counter: funtion counter,
  //   counter2: funtion counter2
  // }
  function assertReducerShape(reducers) {
    Object.keys(reducers).forEach(key => {
      const reducer = reducers[key]
      // 这一步相当于redux手动派发了一次action，ActionTypes.INIT在上文讲过，就是是一个随机的字符串，用来触发reducer里switch判断的defalut 
      // default:
      //   return state;
      // 如果在reducer函数里没有写defalut，或者在default里没有返回state， 那么将会抛出下面的异常
      const initialState = reducer(undefined, { type: ActionTypes.INIT })

      if (typeof initialState === 'undefined') {
        throw new Error(
          `Reducer "${key}" returned undefined during initialization. ` +
            `If the state passed to the reducer is undefined, you must ` +
            `explicitly return the initial state. The initial state may ` +
            `not be undefined. If you don't want to set a value for this reducer, ` +
            `you can use null instead of undefined.`
        )
      }

      // 这里是确保不能占用redux内部特有的命名空间 redux/*
      if (
        typeof reducer(undefined, {
          type: ActionTypes.PROBE_UNKNOWN_ACTION()
        }) === 'undefined'
      ) {
        throw new Error(
          `Reducer "${key}" returned undefined when probed with a random type. ` +
            `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
            `namespace. They are considered private. Instead, you must return the ` +
            `current state for any unknown actions, unless it is undefined, ` +
            `in which case you must return the initial state, regardless of the ` +
            `action type. The initial state may not be undefined, but can be null.`
        )
      }
    })
  }
```
> ### getUnexpectedStateShapeWarningMessage解析，主要是一些警告错误，判断reducers是否为空，inputState是否是简单对象等
```js
  /** 
   * @params inputState 也就是currentState
   * @params reducers 也就是finalReducers
   * @params action
  */
  function getUnexpectedStateShapeWarningMessage(
    inputState,
    reducers,
    action,
    unexpectedKeyCache
  ) {
    // 国际惯例，还是先取出多个reducers属性组成的数组 reducerKeys = ['counter', 'counter2']
    const reducerKeys = Object.keys(reducers)
    const argumentName =
      // 这块其实就是根据action.type来确定报错时候的文案
      action && action.type === ActionTypes.INIT
        ? 'preloadedState argument passed to createStore'
        : 'previous state received by the reducer'
    // 至少要有一个reducer
    if (reducerKeys.length === 0) {
      return (
        'Store does not have a valid reducer. Make sure the argument passed ' +
        'to combineReducers is an object whose values are reducers.'
      )
    }
    // 这个地方判断第一个参数inputState是不是一个简单对象
    // 这个时候机智的小伙伴就已经发现，我们对currentState的判断已经变成了一个简单对象
    // 回忆一下，store.getState()返回的数据格式 {counter: 3, counter2: 3}
    if (!isPlainObject(inputState)) {
      return (
        `The ${argumentName} has unexpected type of "` +
        {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
        `". Expected argument to be an object with the following ` +
        `keys: "${reducerKeys.join('", "')}"`
      )
    }
    // 以下操作主要是用来确保有没有不合理的key
    const unexpectedKeys = Object.keys(inputState).filter(
      // reducers.hasOwnProperty(key)用来判断对象reducers里有没有属性key
      key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
    )

    unexpectedKeys.forEach(key => {
      unexpectedKeyCache[key] = true
    })

    if (action && action.type === ActionTypes.REPLACE) return

    if (unexpectedKeys.length > 0) {
      return (
        `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
        `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
        `Expected to find one of the known reducer keys instead: ` +
        `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
      )
    }
  }
```







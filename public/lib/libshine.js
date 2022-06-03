// Taken from https://github.com/toots/shine/tree/master/js, licensed under the GPL v2

var Shine = (function() {
  var context = {};
  return function() {
    var Module;
    if (!Module) Module = (typeof Module !== "undefined" ? Module : null) || {};
    var moduleOverrides = {};
    for (var key in Module) {
      if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
      }
    }
    var ENVIRONMENT_IS_WEB = false;
    var ENVIRONMENT_IS_WORKER = false;
    var ENVIRONMENT_IS_NODE = false;
    var ENVIRONMENT_IS_SHELL = false;
    if (Module["ENVIRONMENT"]) {
      if (Module["ENVIRONMENT"] === "WEB") {
        ENVIRONMENT_IS_WEB = true;
      } else if (Module["ENVIRONMENT"] === "WORKER") {
        ENVIRONMENT_IS_WORKER = true;
      } else if (Module["ENVIRONMENT"] === "NODE") {
        ENVIRONMENT_IS_NODE = true;
      } else if (Module["ENVIRONMENT"] === "SHELL") {
        ENVIRONMENT_IS_SHELL = true;
      } else {
        throw new Error(
          "The provided Module['ENVIRONMENT'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL."
        );
      }
    } else {
      ENVIRONMENT_IS_WEB = typeof window === "object";
      ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
      ENVIRONMENT_IS_NODE =
        typeof process === "object" &&
        typeof require === "function" &&
        !ENVIRONMENT_IS_WEB &&
        !ENVIRONMENT_IS_WORKER;
      ENVIRONMENT_IS_SHELL =
        !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
    }
    if (ENVIRONMENT_IS_NODE) {
      if (!Module["print"]) Module["print"] = console.log;
      if (!Module["printErr"]) Module["printErr"] = console.warn;
      var nodeFS;
      var nodePath;
      Module["read"] = function shell_read(filename, binary) {
        if (!nodeFS) nodeFS = require("fs");
        if (!nodePath) nodePath = require("path");
        filename = nodePath["normalize"](filename);
        var ret = nodeFS["readFileSync"](filename);
        return binary ? ret : ret.toString();
      };
      Module["readBinary"] = function readBinary(filename) {
        var ret = Module["read"](filename, true);
        if (!ret.buffer) {
          ret = new Uint8Array(ret);
        }
        assert(ret.buffer);
        return ret;
      };
      Module["load"] = function load(f) {
        globalEval(read(f));
      };
      if (!Module["thisProgram"]) {
        if (process["argv"].length > 1) {
          Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
        } else {
          Module["thisProgram"] = "unknown-program";
        }
      }
      Module["arguments"] = process["argv"].slice(2);
      if (typeof module !== "undefined") {
        module["exports"] = Module;
      }
      process["on"]("uncaughtException", function(ex) {
        if (!(ex instanceof ExitStatus)) {
          throw ex;
        }
      });
      Module["inspect"] = function() {
        return "[Emscripten Module object]";
      };
    } else if (ENVIRONMENT_IS_SHELL) {
      if (!Module["print"]) Module["print"] = print;
      if (typeof printErr != "undefined") Module["printErr"] = printErr;
      if (typeof read != "undefined") {
        Module["read"] = read;
      } else {
        Module["read"] = function shell_read() {
          throw "no read() available";
        };
      }
      Module["readBinary"] = function readBinary(f) {
        if (typeof readbuffer === "function") {
          return new Uint8Array(readbuffer(f));
        }
        var data = read(f, "binary");
        assert(typeof data === "object");
        return data;
      };
      if (typeof scriptArgs != "undefined") {
        Module["arguments"] = scriptArgs;
      } else if (typeof arguments != "undefined") {
        Module["arguments"] = arguments;
      }
      if (typeof quit === "function") {
        Module["quit"] = function(status, toThrow) {
          quit(status);
        };
      }
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      Module["read"] = function shell_read(url) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.send(null);
        return xhr.responseText;
      };
      if (ENVIRONMENT_IS_WORKER) {
        Module["readBinary"] = function readBinary(url) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(xhr.response);
        };
      }
      Module["readAsync"] = function readAsync(url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      };
      if (typeof arguments != "undefined") {
        Module["arguments"] = arguments;
      }
      if (typeof console !== "undefined") {
        if (!Module["print"])
          Module["print"] = function shell_print(x) {
            console.log(x);
          };
        if (!Module["printErr"])
          Module["printErr"] = function shell_printErr(x) {
            console.warn(x);
          };
      } else {
        var TRY_USE_DUMP = false;
        if (!Module["print"])
          Module["print"] =
            TRY_USE_DUMP && typeof dump !== "undefined"
              ? function(x) {
                  dump(x);
                }
              : function(x) {};
      }
      if (ENVIRONMENT_IS_WORKER) {
        Module["load"] = importScripts;
      }
      if (typeof Module["setWindowTitle"] === "undefined") {
        Module["setWindowTitle"] = function(title) {
          document.title = title;
        };
      }
    } else {
      throw "Unknown runtime environment. Where are we?";
    }
    function globalEval(x) {
      eval.call(null, x);
    }
    if (!Module["load"] && Module["read"]) {
      Module["load"] = function load(f) {
        globalEval(Module["read"](f));
      };
    }
    if (!Module["print"]) {
      Module["print"] = function() {};
    }
    if (!Module["printErr"]) {
      Module["printErr"] = Module["print"];
    }
    if (!Module["arguments"]) {
      Module["arguments"] = [];
    }
    if (!Module["thisProgram"]) {
      Module["thisProgram"] = "./this.program";
    }
    if (!Module["quit"]) {
      Module["quit"] = function(status, toThrow) {
        throw toThrow;
      };
    }
    Module.print = Module["print"];
    Module.printErr = Module["printErr"];
    Module["preRun"] = [];
    Module["postRun"] = [];
    for (var key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
      }
    }
    moduleOverrides = undefined;
    var Runtime = {
      setTempRet0: function(value) {
        tempRet0 = value;
        return value;
      },
      getTempRet0: function() {
        return tempRet0;
      },
      stackSave: function() {
        return STACKTOP;
      },
      stackRestore: function(stackTop) {
        STACKTOP = stackTop;
      },
      getNativeTypeSize: function(type) {
        switch (type) {
          case "i1":
          case "i8":
            return 1;
          case "i16":
            return 2;
          case "i32":
            return 4;
          case "i64":
            return 8;
          case "float":
            return 4;
          case "double":
            return 8;
          default: {
            if (type[type.length - 1] === "*") {
              return Runtime.QUANTUM_SIZE;
            } else if (type[0] === "i") {
              var bits = parseInt(type.substr(1));
              assert(bits % 8 === 0);
              return bits / 8;
            } else {
              return 0;
            }
          }
        }
      },
      getNativeFieldSize: function(type) {
        return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
      },
      STACK_ALIGN: 16,
      prepVararg: function(ptr, type) {
        if (type === "double" || type === "i64") {
          if (ptr & 7) {
            assert((ptr & 7) === 4);
            ptr += 4;
          }
        } else {
          assert((ptr & 3) === 0);
        }
        return ptr;
      },
      getAlignSize: function(type, size, vararg) {
        if (!vararg && (type == "i64" || type == "double")) return 8;
        if (!type) return Math.min(size, 8);
        return Math.min(
          size || (type ? Runtime.getNativeFieldSize(type) : 0),
          Runtime.QUANTUM_SIZE
        );
      },
      dynCall: function(sig, ptr, args) {
        if (args && args.length) {
          return Module["dynCall_" + sig].apply(null, [ptr].concat(args));
        } else {
          return Module["dynCall_" + sig].call(null, ptr);
        }
      },
      functionPointers: [],
      addFunction: function(func) {
        for (var i = 0; i < Runtime.functionPointers.length; i++) {
          if (!Runtime.functionPointers[i]) {
            Runtime.functionPointers[i] = func;
            return 2 * (1 + i);
          }
        }
        throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
      },
      removeFunction: function(index) {
        Runtime.functionPointers[(index - 2) / 2] = null;
      },
      warnOnce: function(text) {
        if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
        if (!Runtime.warnOnce.shown[text]) {
          Runtime.warnOnce.shown[text] = 1;
          Module.printErr(text);
        }
      },
      funcWrappers: {},
      getFuncWrapper: function(func, sig) {
        assert(sig);
        if (!Runtime.funcWrappers[sig]) {
          Runtime.funcWrappers[sig] = {};
        }
        var sigCache = Runtime.funcWrappers[sig];
        if (!sigCache[func]) {
          if (sig.length === 1) {
            sigCache[func] = function dynCall_wrapper() {
              return Runtime.dynCall(sig, func);
            };
          } else if (sig.length === 2) {
            sigCache[func] = function dynCall_wrapper(arg) {
              return Runtime.dynCall(sig, func, [arg]);
            };
          } else {
            sigCache[func] = function dynCall_wrapper() {
              return Runtime.dynCall(
                sig,
                func,
                Array.prototype.slice.call(arguments)
              );
            };
          }
        }
        return sigCache[func];
      },
      getCompilerSetting: function(name) {
        throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work";
      },
      stackAlloc: function(size) {
        var ret = STACKTOP;
        STACKTOP = (STACKTOP + size) | 0;
        STACKTOP = (STACKTOP + 15) & -16;
        return ret;
      },
      staticAlloc: function(size) {
        var ret = STATICTOP;
        STATICTOP = (STATICTOP + size) | 0;
        STATICTOP = (STATICTOP + 15) & -16;
        return ret;
      },
      dynamicAlloc: function(size) {
        var ret = HEAP32[DYNAMICTOP_PTR >> 2];
        var end = ((ret + size + 15) | 0) & -16;
        HEAP32[DYNAMICTOP_PTR >> 2] = end;
        if (end >= TOTAL_MEMORY) {
          var success = enlargeMemory();
          if (!success) {
            HEAP32[DYNAMICTOP_PTR >> 2] = ret;
            return 0;
          }
        }
        return ret;
      },
      alignMemory: function(size, quantum) {
        var ret = (size =
          Math.ceil(size / (quantum ? quantum : 16)) *
          (quantum ? quantum : 16));
        return ret;
      },
      makeBigInt: function(low, high, unsigned) {
        var ret = unsigned
          ? +(low >>> 0) + +(high >>> 0) * +4294967296
          : +(low >>> 0) + +(high | 0) * +4294967296;
        return ret;
      },
      GLOBAL_BASE: 8,
      QUANTUM_SIZE: 4,
      __dummy__: 0,
    };
    Module["Runtime"] = Runtime;
    var ABORT = 0;
    var EXITSTATUS = 0;
    function assert(condition, text) {
      if (!condition) {
        abort("Assertion failed: " + text);
      }
    }
    function getCFunc(ident) {
      var func = Module["_" + ident];
      if (!func) {
        try {
          func = eval("_" + ident);
        } catch (e) {}
      }
      assert(
        func,
        "Cannot call unknown function " +
          ident +
          " (perhaps LLVM optimizations or closure removed it?)"
      );
      return func;
    }
    var cwrap, ccall;
    (function() {
      var JSfuncs = {
        stackSave: function() {
          Runtime.stackSave();
        },
        stackRestore: function() {
          Runtime.stackRestore();
        },
        arrayToC: function(arr) {
          var ret = Runtime.stackAlloc(arr.length);
          writeArrayToMemory(arr, ret);
          return ret;
        },
        stringToC: function(str) {
          var ret = 0;
          if (str !== null && str !== undefined && str !== 0) {
            var len = (str.length << 2) + 1;
            ret = Runtime.stackAlloc(len);
            stringToUTF8(str, ret, len);
          }
          return ret;
        },
      };
      var toC = { string: JSfuncs["stringToC"], array: JSfuncs["arrayToC"] };
      ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
        var func = getCFunc(ident);
        var cArgs = [];
        var stack = 0;
        if (args) {
          for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
              if (stack === 0) stack = Runtime.stackSave();
              cArgs[i] = converter(args[i]);
            } else {
              cArgs[i] = args[i];
            }
          }
        }
        var ret = func.apply(null, cArgs);
        if (returnType === "string") ret = Pointer_stringify(ret);
        if (stack !== 0) {
          if (opts && opts.async) {
            EmterpreterAsync.asyncFinalizers.push(function() {
              Runtime.stackRestore(stack);
            });
            return;
          }
          Runtime.stackRestore(stack);
        }
        return ret;
      };
      var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
      function parseJSFunc(jsfunc) {
        var parsed = jsfunc
          .toString()
          .match(sourceRegex)
          .slice(1);
        return {
          arguments: parsed[0],
          body: parsed[1],
          returnValue: parsed[2],
        };
      }
      var JSsource = null;
      function ensureJSsource() {
        if (!JSsource) {
          JSsource = {};
          for (var fun in JSfuncs) {
            if (JSfuncs.hasOwnProperty(fun)) {
              JSsource[fun] = parseJSFunc(JSfuncs[fun]);
            }
          }
        }
      }
      cwrap = function cwrap(ident, returnType, argTypes) {
        argTypes = argTypes || [];
        var cfunc = getCFunc(ident);
        var numericArgs = argTypes.every(function(type) {
          return type === "number";
        });
        var numericRet = returnType !== "string";
        if (numericRet && numericArgs) {
          return cfunc;
        }
        var argNames = argTypes.map(function(x, i) {
          return "$" + i;
        });
        var funcstr = "(function(" + argNames.join(",") + ") {";
        var nargs = argTypes.length;
        if (!numericArgs) {
          ensureJSsource();
          funcstr += "var stack = " + JSsource["stackSave"].body + ";";
          for (var i = 0; i < nargs; i++) {
            var arg = argNames[i],
              type = argTypes[i];
            if (type === "number") continue;
            var convertCode = JSsource[type + "ToC"];
            funcstr += "var " + convertCode.arguments + " = " + arg + ";";
            funcstr += convertCode.body + ";";
            funcstr += arg + "=(" + convertCode.returnValue + ");";
          }
        }
        var cfuncname = parseJSFunc(function() {
          return cfunc;
        }).returnValue;
        funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
        if (!numericRet) {
          var strgfy = parseJSFunc(function() {
            return Pointer_stringify;
          }).returnValue;
          funcstr += "ret = " + strgfy + "(ret);";
        }
        if (!numericArgs) {
          ensureJSsource();
          funcstr +=
            JSsource["stackRestore"].body.replace("()", "(stack)") + ";";
        }
        funcstr += "return ret})";
        return eval(funcstr);
      };
    })();
    Module["ccall"] = ccall;
    Module["cwrap"] = cwrap;
    function setValue(ptr, value, type, noSafe) {
      type = type || "i8";
      if (type.charAt(type.length - 1) === "*") type = "i32";
      switch (type) {
        case "i1":
          HEAP8[ptr >> 0] = value;
          break;
        case "i8":
          HEAP8[ptr >> 0] = value;
          break;
        case "i16":
          HEAP16[ptr >> 1] = value;
          break;
        case "i32":
          HEAP32[ptr >> 2] = value;
          break;
        case "i64":
          (tempI64 = [
            value >>> 0,
            ((tempDouble = value),
            +Math_abs(tempDouble) >= +1
              ? tempDouble > +0
                ? (Math_min(
                    +Math_floor(tempDouble / +4294967296),
                    +4294967295
                  ) |
                    0) >>>
                  0
                : ~~+Math_ceil(
                    (tempDouble - +(~~tempDouble >>> 0)) / +4294967296
                  ) >>> 0
              : 0),
          ]),
            (HEAP32[ptr >> 2] = tempI64[0]),
            (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
          break;
        case "float":
          HEAPF32[ptr >> 2] = value;
          break;
        case "double":
          HEAPF64[ptr >> 3] = value;
          break;
        default:
          abort("invalid type for setValue: " + type);
      }
    }
    Module["setValue"] = setValue;
    function getValue(ptr, type, noSafe) {
      type = type || "i8";
      if (type.charAt(type.length - 1) === "*") type = "i32";
      switch (type) {
        case "i1":
          return HEAP8[ptr >> 0];
        case "i8":
          return HEAP8[ptr >> 0];
        case "i16":
          return HEAP16[ptr >> 1];
        case "i32":
          return HEAP32[ptr >> 2];
        case "i64":
          return HEAP32[ptr >> 2];
        case "float":
          return HEAPF32[ptr >> 2];
        case "double":
          return HEAPF64[ptr >> 3];
        default:
          abort("invalid type for setValue: " + type);
      }
      return null;
    }
    Module["getValue"] = getValue;
    var ALLOC_NORMAL = 0;
    var ALLOC_STACK = 1;
    var ALLOC_STATIC = 2;
    var ALLOC_DYNAMIC = 3;
    var ALLOC_NONE = 4;
    Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
    Module["ALLOC_STACK"] = ALLOC_STACK;
    Module["ALLOC_STATIC"] = ALLOC_STATIC;
    Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
    Module["ALLOC_NONE"] = ALLOC_NONE;
    function allocate(slab, types, allocator, ptr) {
      var zeroinit, size;
      if (typeof slab === "number") {
        zeroinit = true;
        size = slab;
      } else {
        zeroinit = false;
        size = slab.length;
      }
      var singleType = typeof types === "string" ? types : null;
      var ret;
      if (allocator == ALLOC_NONE) {
        ret = ptr;
      } else {
        ret = [
          typeof _malloc === "function" ? _malloc : Runtime.staticAlloc,
          Runtime.stackAlloc,
          Runtime.staticAlloc,
          Runtime.dynamicAlloc,
        ][allocator === undefined ? ALLOC_STATIC : allocator](
          Math.max(size, singleType ? 1 : types.length)
        );
      }
      if (zeroinit) {
        var ptr = ret,
          stop;
        assert((ret & 3) == 0);
        stop = ret + (size & ~3);
        for (; ptr < stop; ptr += 4) {
          HEAP32[ptr >> 2] = 0;
        }
        stop = ret + size;
        while (ptr < stop) {
          HEAP8[ptr++ >> 0] = 0;
        }
        return ret;
      }
      if (singleType === "i8") {
        if (slab.subarray || slab.slice) {
          HEAPU8.set(slab, ret);
        } else {
          HEAPU8.set(new Uint8Array(slab), ret);
        }
        return ret;
      }
      var i = 0,
        type,
        typeSize,
        previousType;
      while (i < size) {
        var curr = slab[i];
        if (typeof curr === "function") {
          curr = Runtime.getFunctionIndex(curr);
        }
        type = singleType || types[i];
        if (type === 0) {
          i++;
          continue;
        }
        if (type == "i64") type = "i32";
        setValue(ret + i, curr, type);
        if (previousType !== type) {
          typeSize = Runtime.getNativeTypeSize(type);
          previousType = type;
        }
        i += typeSize;
      }
      return ret;
    }
    Module["allocate"] = allocate;
    function getMemory(size) {
      if (!staticSealed) return Runtime.staticAlloc(size);
      if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
      return _malloc(size);
    }
    Module["getMemory"] = getMemory;
    function Pointer_stringify(ptr, length) {
      if (length === 0 || !ptr) return "";
      var hasUtf = 0;
      var t;
      var i = 0;
      while (1) {
        t = HEAPU8[(ptr + i) >> 0];
        hasUtf |= t;
        if (t == 0 && !length) break;
        i++;
        if (length && i == length) break;
      }
      if (!length) length = i;
      var ret = "";
      if (hasUtf < 128) {
        var MAX_CHUNK = 1024;
        var curr;
        while (length > 0) {
          curr = String.fromCharCode.apply(
            String,
            HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK))
          );
          ret = ret ? ret + curr : curr;
          ptr += MAX_CHUNK;
          length -= MAX_CHUNK;
        }
        return ret;
      }
      return Module["UTF8ToString"](ptr);
    }
    Module["Pointer_stringify"] = Pointer_stringify;
    function AsciiToString(ptr) {
      var str = "";
      while (1) {
        var ch = HEAP8[ptr++ >> 0];
        if (!ch) return str;
        str += String.fromCharCode(ch);
      }
    }
    Module["AsciiToString"] = AsciiToString;
    function stringToAscii(str, outPtr) {
      return writeAsciiToMemory(str, outPtr, false);
    }
    Module["stringToAscii"] = stringToAscii;
    var UTF8Decoder =
      typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
    function UTF8ArrayToString(u8Array, idx) {
      var endPtr = idx;
      while (u8Array[endPtr]) ++endPtr;
      if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
      } else {
        var u0, u1, u2, u3, u4, u5;
        var str = "";
        while (1) {
          u0 = u8Array[idx++];
          if (!u0) return str;
          if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
          }
          u1 = u8Array[idx++] & 63;
          if ((u0 & 224) == 192) {
            str += String.fromCharCode(((u0 & 31) << 6) | u1);
            continue;
          }
          u2 = u8Array[idx++] & 63;
          if ((u0 & 240) == 224) {
            u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
          } else {
            u3 = u8Array[idx++] & 63;
            if ((u0 & 248) == 240) {
              u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
            } else {
              u4 = u8Array[idx++] & 63;
              if ((u0 & 252) == 248) {
                u0 =
                  ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
              } else {
                u5 = u8Array[idx++] & 63;
                u0 =
                  ((u0 & 1) << 30) |
                  (u1 << 24) |
                  (u2 << 18) |
                  (u3 << 12) |
                  (u4 << 6) |
                  u5;
              }
            }
          }
          if (u0 < 65536) {
            str += String.fromCharCode(u0);
          } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
          }
        }
      }
    }
    Module["UTF8ArrayToString"] = UTF8ArrayToString;
    function UTF8ToString(ptr) {
      return UTF8ArrayToString(HEAPU8, ptr);
    }
    Module["UTF8ToString"] = UTF8ToString;
    function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
      if (!(maxBytesToWrite > 0)) return 0;
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343)
          u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
        if (u <= 127) {
          if (outIdx >= endIdx) break;
          outU8Array[outIdx++] = u;
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break;
          outU8Array[outIdx++] = 192 | (u >> 6);
          outU8Array[outIdx++] = 128 | (u & 63);
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break;
          outU8Array[outIdx++] = 224 | (u >> 12);
          outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
          outU8Array[outIdx++] = 128 | (u & 63);
        } else if (u <= 2097151) {
          if (outIdx + 3 >= endIdx) break;
          outU8Array[outIdx++] = 240 | (u >> 18);
          outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
          outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
          outU8Array[outIdx++] = 128 | (u & 63);
        } else if (u <= 67108863) {
          if (outIdx + 4 >= endIdx) break;
          outU8Array[outIdx++] = 248 | (u >> 24);
          outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
          outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
          outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
          outU8Array[outIdx++] = 128 | (u & 63);
        } else {
          if (outIdx + 5 >= endIdx) break;
          outU8Array[outIdx++] = 252 | (u >> 30);
          outU8Array[outIdx++] = 128 | ((u >> 24) & 63);
          outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
          outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
          outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
          outU8Array[outIdx++] = 128 | (u & 63);
        }
      }
      outU8Array[outIdx] = 0;
      return outIdx - startIdx;
    }
    Module["stringToUTF8Array"] = stringToUTF8Array;
    function stringToUTF8(str, outPtr, maxBytesToWrite) {
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    }
    Module["stringToUTF8"] = stringToUTF8;
    function lengthBytesUTF8(str) {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343)
          u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
        if (u <= 127) {
          ++len;
        } else if (u <= 2047) {
          len += 2;
        } else if (u <= 65535) {
          len += 3;
        } else if (u <= 2097151) {
          len += 4;
        } else if (u <= 67108863) {
          len += 5;
        } else {
          len += 6;
        }
      }
      return len;
    }
    Module["lengthBytesUTF8"] = lengthBytesUTF8;
    var UTF16Decoder =
      typeof TextDecoder !== "undefined"
        ? new TextDecoder("utf-16le")
        : undefined;
    function demangle(func) {
      var __cxa_demangle_func =
        Module["___cxa_demangle"] || Module["__cxa_demangle"];
      if (__cxa_demangle_func) {
        try {
          var s = func.substr(1);
          var len = lengthBytesUTF8(s) + 1;
          var buf = _malloc(len);
          stringToUTF8(s, buf, len);
          var status = _malloc(4);
          var ret = __cxa_demangle_func(buf, 0, 0, status);
          if (getValue(status, "i32") === 0 && ret) {
            return Pointer_stringify(ret);
          }
        } catch (e) {
        } finally {
          if (buf) _free(buf);
          if (status) _free(status);
          if (ret) _free(ret);
        }
        return func;
      }
      Runtime.warnOnce(
        "warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling"
      );
      return func;
    }
    function demangleAll(text) {
      var regex = /__Z[\w\d_]+/g;
      return text.replace(regex, function(x) {
        var y = demangle(x);
        return x === y ? x : x + " [" + y + "]";
      });
    }
    function jsStackTrace() {
      var err = new Error();
      if (!err.stack) {
        try {
          throw new Error(0);
        } catch (e) {
          err = e;
        }
        if (!err.stack) {
          return "(no stack trace available)";
        }
      }
      return err.stack.toString();
    }
    function stackTrace() {
      var js = jsStackTrace();
      if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
      return demangleAll(js);
    }
    Module["stackTrace"] = stackTrace;
    var HEAP,
      buffer,
      HEAP8,
      HEAPU8,
      HEAP16,
      HEAPU16,
      HEAP32,
      HEAPU32,
      HEAPF32,
      HEAPF64;
    function updateGlobalBufferViews() {
      Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
      Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
      Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
      Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
      Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
      Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
      Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
      Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
    }
    var STATIC_BASE, STATICTOP, staticSealed;
    var STACK_BASE, STACKTOP, STACK_MAX;
    var DYNAMIC_BASE, DYNAMICTOP_PTR;
    STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
    staticSealed = false;
    function abortOnCannotGrowMemory() {
      abort(
        "Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " +
          TOTAL_MEMORY +
          ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 "
      );
    }
    function enlargeMemory() {
      abortOnCannotGrowMemory();
    }
    var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
    var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
    if (TOTAL_MEMORY < TOTAL_STACK)
      Module.printErr(
        "TOTAL_MEMORY should be larger than TOTAL_STACK, was " +
          TOTAL_MEMORY +
          "! (TOTAL_STACK=" +
          TOTAL_STACK +
          ")"
      );
    if (Module["buffer"]) {
      buffer = Module["buffer"];
    } else {
      {
        buffer = new ArrayBuffer(TOTAL_MEMORY);
      }
    }
    updateGlobalBufferViews();
    function getTotalMemory() {
      return TOTAL_MEMORY;
    }
    HEAP32[0] = 1668509029;
    HEAP16[1] = 25459;
    if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99)
      throw "Runtime error: expected the system to be little-endian!";
    Module["HEAP"] = HEAP;
    Module["buffer"] = buffer;
    Module["HEAP8"] = HEAP8;
    Module["HEAP16"] = HEAP16;
    Module["HEAP32"] = HEAP32;
    Module["HEAPU8"] = HEAPU8;
    Module["HEAPU16"] = HEAPU16;
    Module["HEAPU32"] = HEAPU32;
    Module["HEAPF32"] = HEAPF32;
    Module["HEAPF64"] = HEAPF64;
    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
          callback();
          continue;
        }
        var func = callback.func;
        if (typeof func === "number") {
          if (callback.arg === undefined) {
            Module["dynCall_v"](func);
          } else {
            Module["dynCall_vi"](func, callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATMAIN__ = [];
    var __ATEXIT__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    var runtimeExited = false;
    function preRun() {
      if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
          Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
          addOnPreRun(Module["preRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPRERUN__);
    }
    function ensureInitRuntime() {
      if (runtimeInitialized) return;
      runtimeInitialized = true;
      callRuntimeCallbacks(__ATINIT__);
    }
    function preMain() {
      callRuntimeCallbacks(__ATMAIN__);
    }
    function exitRuntime() {
      callRuntimeCallbacks(__ATEXIT__);
      runtimeExited = true;
    }
    function postRun() {
      if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
          Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
          addOnPostRun(Module["postRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }
    Module["addOnPreRun"] = addOnPreRun;
    function addOnInit(cb) {
      __ATINIT__.unshift(cb);
    }
    Module["addOnInit"] = addOnInit;
    function addOnPreMain(cb) {
      __ATMAIN__.unshift(cb);
    }
    Module["addOnPreMain"] = addOnPreMain;
    function addOnExit(cb) {
      __ATEXIT__.unshift(cb);
    }
    Module["addOnExit"] = addOnExit;
    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }
    Module["addOnPostRun"] = addOnPostRun;
    function intArrayFromString(stringy, dontAddNull, length) {
      var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(
        stringy,
        u8array,
        0,
        u8array.length
      );
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    }
    Module["intArrayFromString"] = intArrayFromString;
    function intArrayToString(array) {
      var ret = [];
      for (var i = 0; i < array.length; i++) {
        var chr = array[i];
        if (chr > 255) {
          chr &= 255;
        }
        ret.push(String.fromCharCode(chr));
      }
      return ret.join("");
    }
    Module["intArrayToString"] = intArrayToString;
    function writeStringToMemory(string, buffer, dontAddNull) {
      Runtime.warnOnce(
        "writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!"
      );
      var lastChar, end;
      if (dontAddNull) {
        end = buffer + lengthBytesUTF8(string);
        lastChar = HEAP8[end];
      }
      stringToUTF8(string, buffer, Infinity);
      if (dontAddNull) HEAP8[end] = lastChar;
    }
    Module["writeStringToMemory"] = writeStringToMemory;
    function writeArrayToMemory(array, buffer) {
      HEAP8.set(array, buffer);
    }
    Module["writeArrayToMemory"] = writeArrayToMemory;
    function writeAsciiToMemory(str, buffer, dontAddNull) {
      for (var i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i);
      }
      if (!dontAddNull) HEAP8[buffer >> 0] = 0;
    }
    Module["writeAsciiToMemory"] = writeAsciiToMemory;
    if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5)
      Math["imul"] = function imul(a, b) {
        var ah = a >>> 16;
        var al = a & 65535;
        var bh = b >>> 16;
        var bl = b & 65535;
        return (al * bl + ((ah * bl + al * bh) << 16)) | 0;
      };
    Math.imul = Math["imul"];
    if (!Math["clz32"])
      Math["clz32"] = function(x) {
        x = x >>> 0;
        for (var i = 0; i < 32; i++) {
          if (x & (1 << (31 - i))) return i;
        }
        return 32;
      };
    Math.clz32 = Math["clz32"];
    if (!Math["trunc"])
      Math["trunc"] = function(x) {
        return x < 0 ? Math.ceil(x) : Math.floor(x);
      };
    Math.trunc = Math["trunc"];
    var Math_abs = Math.abs;
    var Math_cos = Math.cos;
    var Math_sin = Math.sin;
    var Math_tan = Math.tan;
    var Math_acos = Math.acos;
    var Math_asin = Math.asin;
    var Math_atan = Math.atan;
    var Math_atan2 = Math.atan2;
    var Math_exp = Math.exp;
    var Math_log = Math.log;
    var Math_sqrt = Math.sqrt;
    var Math_ceil = Math.ceil;
    var Math_floor = Math.floor;
    var Math_pow = Math.pow;
    var Math_imul = Math.imul;
    var Math_fround = Math.fround;
    var Math_round = Math.round;
    var Math_min = Math.min;
    var Math_clz32 = Math.clz32;
    var Math_trunc = Math.trunc;
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;
    function addRunDependency(id) {
      runDependencies++;
      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies);
      }
    }
    Module["addRunDependency"] = addRunDependency;
    function removeRunDependency(id) {
      runDependencies--;
      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies);
      }
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }
    Module["removeRunDependency"] = removeRunDependency;
    Module["preloadedImages"] = {};
    Module["preloadedAudios"] = {};
    var ASM_CONSTS = [];
    STATIC_BASE = Runtime.GLOBAL_BASE;
    STATICTOP = STATIC_BASE + 10560;
    __ATINIT__.push();
    allocate(
      [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        104,
        18,
        0,
        0,
        108,
        29,
        0,
        0,
        3,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        112,
        18,
        0,
        0,
        112,
        29,
        0,
        0,
        3,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        130,
        18,
        0,
        0,
        121,
        29,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        148,
        18,
        0,
        0,
        130,
        29,
        0,
        0,
        4,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        180,
        18,
        0,
        0,
        146,
        29,
        0,
        0,
        6,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        212,
        18,
        0,
        0,
        162,
        29,
        0,
        0,
        6,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        28,
        19,
        0,
        0,
        198,
        29,
        0,
        0,
        6,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        100,
        19,
        0,
        0,
        234,
        29,
        0,
        0,
        8,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        172,
        19,
        0,
        0,
        14,
        30,
        0,
        0,
        8,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        44,
        20,
        0,
        0,
        78,
        30,
        0,
        0,
        8,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        172,
        20,
        0,
        0,
        142,
        30,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        44,
        21,
        0,
        0,
        206,
        30,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        44,
        23,
        0,
        0,
        206,
        31,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        7,
        0,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        15,
        0,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        63,
        0,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        255,
        0,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        10,
        0,
        0,
        0,
        255,
        3,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        13,
        0,
        0,
        0,
        255,
        31,
        0,
        0,
        44,
        25,
        0,
        0,
        206,
        32,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        15,
        0,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        31,
        0,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        63,
        0,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        7,
        0,
        0,
        0,
        127,
        0,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        255,
        0,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        9,
        0,
        0,
        0,
        255,
        1,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        11,
        0,
        0,
        0,
        255,
        7,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        16,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        13,
        0,
        0,
        0,
        255,
        31,
        0,
        0,
        44,
        27,
        0,
        0,
        206,
        33,
        0,
        0,
        1,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        44,
        29,
        0,
        0,
        206,
        34,
        0,
        0,
        1,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        76,
        29,
        0,
        0,
        222,
        34,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        7,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        7,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        7,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        11,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        21,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        68,
        172,
        0,
        0,
        128,
        187,
        0,
        0,
        0,
        125,
        0,
        0,
        34,
        86,
        0,
        0,
        192,
        93,
        0,
        0,
        128,
        62,
        0,
        0,
        17,
        43,
        0,
        0,
        224,
        46,
        0,
        0,
        64,
        31,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        8,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        8,
        0,
        0,
        0,
        32,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        16,
        0,
        0,
        0,
        40,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        24,
        0,
        0,
        0,
        48,
        0,
        0,
        0,
        32,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        32,
        0,
        0,
        0,
        56,
        0,
        0,
        0,
        40,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        40,
        0,
        0,
        0,
        64,
        0,
        0,
        0,
        48,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        48,
        0,
        0,
        0,
        80,
        0,
        0,
        0,
        56,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        56,
        0,
        0,
        0,
        96,
        0,
        0,
        0,
        64,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        64,
        0,
        0,
        0,
        112,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        80,
        0,
        0,
        0,
        128,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        96,
        0,
        0,
        0,
        160,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        112,
        0,
        0,
        0,
        192,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        128,
        0,
        0,
        0,
        224,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        144,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        160,
        0,
        0,
        0,
        64,
        1,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        20,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        52,
        0,
        0,
        0,
        62,
        0,
        0,
        0,
        74,
        0,
        0,
        0,
        90,
        0,
        0,
        0,
        110,
        0,
        0,
        0,
        134,
        0,
        0,
        0,
        162,
        0,
        0,
        0,
        196,
        0,
        0,
        0,
        238,
        0,
        0,
        0,
        32,
        1,
        0,
        0,
        86,
        1,
        0,
        0,
        162,
        1,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        20,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        42,
        0,
        0,
        0,
        50,
        0,
        0,
        0,
        60,
        0,
        0,
        0,
        72,
        0,
        0,
        0,
        88,
        0,
        0,
        0,
        106,
        0,
        0,
        0,
        128,
        0,
        0,
        0,
        156,
        0,
        0,
        0,
        190,
        0,
        0,
        0,
        230,
        0,
        0,
        0,
        20,
        1,
        0,
        0,
        74,
        1,
        0,
        0,
        128,
        1,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        8,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        16,
        0,
        0,
        0,
        20,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        54,
        0,
        0,
        0,
        66,
        0,
        0,
        0,
        82,
        0,
        0,
        0,
        102,
        0,
        0,
        0,
        126,
        0,
        0,
        0,
        156,
        0,
        0,
        0,
        194,
        0,
        0,
        0,
        240,
        0,
        0,
        0,
        40,
        1,
        0,
        0,
        108,
        1,
        0,
        0,
        192,
        1,
        0,
        0,
        38,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        18,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        54,
        0,
        0,
        0,
        66,
        0,
        0,
        0,
        80,
        0,
        0,
        0,
        96,
        0,
        0,
        0,
        116,
        0,
        0,
        0,
        140,
        0,
        0,
        0,
        168,
        0,
        0,
        0,
        200,
        0,
        0,
        0,
        238,
        0,
        0,
        0,
        28,
        1,
        0,
        0,
        80,
        1,
        0,
        0,
        140,
        1,
        0,
        0,
        208,
        1,
        0,
        0,
        10,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        18,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        54,
        0,
        0,
        0,
        66,
        0,
        0,
        0,
        80,
        0,
        0,
        0,
        96,
        0,
        0,
        0,
        114,
        0,
        0,
        0,
        136,
        0,
        0,
        0,
        162,
        0,
        0,
        0,
        194,
        0,
        0,
        0,
        232,
        0,
        0,
        0,
        22,
        1,
        0,
        0,
        74,
        1,
        0,
        0,
        138,
        1,
        0,
        0,
        208,
        1,
        0,
        0,
        28,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        18,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        45,
        0,
        0,
        0,
        66,
        0,
        0,
        0,
        80,
        0,
        0,
        0,
        96,
        0,
        0,
        0,
        116,
        0,
        0,
        0,
        140,
        0,
        0,
        0,
        168,
        0,
        0,
        0,
        200,
        0,
        0,
        0,
        238,
        0,
        0,
        0,
        248,
        0,
        0,
        0,
        80,
        1,
        0,
        0,
        140,
        1,
        0,
        0,
        208,
        1,
        0,
        0,
        10,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        18,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        54,
        0,
        0,
        0,
        66,
        0,
        0,
        0,
        80,
        0,
        0,
        0,
        96,
        0,
        0,
        0,
        116,
        0,
        0,
        0,
        140,
        0,
        0,
        0,
        168,
        0,
        0,
        0,
        200,
        0,
        0,
        0,
        238,
        0,
        0,
        0,
        28,
        1,
        0,
        0,
        80,
        1,
        0,
        0,
        140,
        1,
        0,
        0,
        208,
        1,
        0,
        0,
        10,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        18,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        30,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        44,
        0,
        0,
        0,
        54,
        0,
        0,
        0,
        66,
        0,
        0,
        0,
        80,
        0,
        0,
        0,
        96,
        0,
        0,
        0,
        116,
        0,
        0,
        0,
        140,
        0,
        0,
        0,
        168,
        0,
        0,
        0,
        200,
        0,
        0,
        0,
        238,
        0,
        0,
        0,
        28,
        1,
        0,
        0,
        80,
        1,
        0,
        0,
        140,
        1,
        0,
        0,
        208,
        1,
        0,
        0,
        10,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        12,
        0,
        0,
        0,
        24,
        0,
        0,
        0,
        36,
        0,
        0,
        0,
        48,
        0,
        0,
        0,
        60,
        0,
        0,
        0,
        72,
        0,
        0,
        0,
        88,
        0,
        0,
        0,
        108,
        0,
        0,
        0,
        132,
        0,
        0,
        0,
        160,
        0,
        0,
        0,
        192,
        0,
        0,
        0,
        232,
        0,
        0,
        0,
        24,
        1,
        0,
        0,
        80,
        1,
        0,
        0,
        144,
        1,
        0,
        0,
        220,
        1,
        0,
        0,
        54,
        2,
        0,
        0,
        56,
        2,
        0,
        0,
        58,
        2,
        0,
        0,
        60,
        2,
        0,
        0,
        62,
        2,
        0,
        0,
        64,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        157,
        247,
        255,
        255,
        157,
        247,
        255,
        255,
        157,
        247,
        255,
        255,
        157,
        247,
        255,
        255,
        157,
        247,
        255,
        255,
        157,
        247,
        255,
        255,
        58,
        239,
        255,
        255,
        58,
        239,
        255,
        255,
        58,
        239,
        255,
        255,
        58,
        239,
        255,
        255,
        214,
        230,
        255,
        255,
        214,
        230,
        255,
        255,
        214,
        230,
        255,
        255,
        115,
        222,
        255,
        255,
        115,
        222,
        255,
        255,
        15,
        214,
        255,
        255,
        15,
        214,
        255,
        255,
        172,
        205,
        255,
        255,
        72,
        197,
        255,
        255,
        229,
        188,
        255,
        255,
        229,
        188,
        255,
        255,
        129,
        180,
        255,
        255,
        30,
        172,
        255,
        255,
        186,
        163,
        255,
        255,
        87,
        155,
        255,
        255,
        144,
        138,
        255,
        255,
        44,
        130,
        255,
        255,
        101,
        113,
        255,
        255,
        2,
        105,
        255,
        255,
        59,
        88,
        255,
        255,
        215,
        79,
        255,
        255,
        16,
        63,
        255,
        255,
        73,
        46,
        255,
        255,
        31,
        21,
        255,
        255,
        88,
        4,
        255,
        255,
        145,
        243,
        254,
        255,
        103,
        218,
        254,
        255,
        60,
        193,
        254,
        255,
        18,
        168,
        254,
        255,
        75,
        151,
        254,
        255,
        32,
        126,
        254,
        255,
        146,
        92,
        254,
        255,
        104,
        67,
        254,
        255,
        61,
        42,
        254,
        255,
        175,
        8,
        254,
        255,
        133,
        239,
        253,
        255,
        91,
        214,
        253,
        255,
        205,
        180,
        253,
        255,
        162,
        155,
        253,
        255,
        20,
        122,
        253,
        255,
        134,
        88,
        253,
        255,
        92,
        63,
        253,
        255,
        49,
        38,
        253,
        255,
        163,
        4,
        253,
        255,
        221,
        243,
        252,
        255,
        178,
        218,
        252,
        255,
        136,
        193,
        252,
        255,
        163,
        87,
        3,
        0,
        106,
        104,
        3,
        0,
        49,
        121,
        3,
        0,
        148,
        129,
        3,
        0,
        248,
        137,
        3,
        0,
        91,
        146,
        3,
        0,
        91,
        146,
        3,
        0,
        248,
        137,
        3,
        0,
        148,
        129,
        3,
        0,
        205,
        112,
        3,
        0,
        6,
        96,
        3,
        0,
        120,
        62,
        3,
        0,
        234,
        28,
        3,
        0,
        249,
        242,
        2,
        0,
        164,
        192,
        2,
        0,
        79,
        142,
        2,
        0,
        51,
        75,
        2,
        0,
        180,
        255,
        1,
        0,
        209,
        171,
        1,
        0,
        139,
        79,
        1,
        0,
        126,
        226,
        0,
        0,
        112,
        117,
        0,
        0,
        157,
        247,
        255,
        255,
        101,
        113,
        255,
        255,
        202,
        226,
        254,
        255,
        104,
        67,
        254,
        255,
        162,
        155,
        253,
        255,
        121,
        235,
        252,
        255,
        236,
        50,
        252,
        255,
        153,
        105,
        251,
        255,
        226,
        151,
        250,
        255,
        199,
        189,
        249,
        255,
        230,
        210,
        248,
        255,
        4,
        232,
        247,
        255,
        92,
        236,
        246,
        255,
        80,
        232,
        245,
        255,
        68,
        228,
        244,
        255,
        212,
        215,
        243,
        255,
        1,
        195,
        242,
        255,
        203,
        165,
        241,
        255,
        49,
        128,
        240,
        255,
        250,
        98,
        239,
        255,
        96,
        61,
        238,
        255,
        198,
        23,
        237,
        255,
        45,
        242,
        235,
        255,
        147,
        204,
        234,
        255,
        92,
        175,
        233,
        255,
        137,
        154,
        232,
        255,
        182,
        133,
        231,
        255,
        71,
        121,
        230,
        255,
        59,
        117,
        229,
        255,
        246,
        129,
        228,
        255,
        120,
        159,
        227,
        255,
        93,
        197,
        226,
        255,
        109,
        4,
        226,
        255,
        68,
        84,
        225,
        255,
        69,
        189,
        224,
        255,
        113,
        63,
        224,
        255,
        199,
        218,
        223,
        255,
        171,
        151,
        223,
        255,
        186,
        109,
        223,
        255,
        86,
        101,
        223,
        255,
        129,
        126,
        223,
        255,
        157,
        193,
        223,
        255,
        86,
        209,
        31,
        0,
        187,
        66,
        31,
        0,
        203,
        129,
        30,
        0,
        233,
        150,
        29,
        0,
        179,
        121,
        28,
        0,
        39,
        42,
        27,
        0,
        171,
        176,
        25,
        0,
        118,
        252,
        23,
        0,
        235,
        21,
        22,
        0,
        13,
        253,
        19,
        0,
        117,
        169,
        17,
        0,
        236,
        43,
        15,
        0,
        72,
        107,
        12,
        0,
        235,
        111,
        9,
        0,
        156,
        74,
        6,
        0,
        50,
        226,
        2,
        0,
        215,
        79,
        255,
        255,
        195,
        130,
        251,
        255,
        247,
        122,
        247,
        255,
        57,
        73,
        243,
        255,
        38,
        229,
        238,
        255,
        190,
        78,
        234,
        255,
        101,
        142,
        229,
        255,
        27,
        164,
        224,
        255,
        66,
        152,
        219,
        255,
        120,
        98,
        214,
        255,
        132,
        19,
        209,
        255,
        2,
        163,
        203,
        255,
        85,
        25,
        198,
        255,
        69,
        135,
        192,
        255,
        10,
        220,
        186,
        255,
        207,
        48,
        181,
        255,
        49,
        125,
        175,
        255,
        147,
        201,
        169,
        255,
        188,
        38,
        164,
        255,
        72,
        140,
        158,
        255,
        255,
        10,
        153,
        255,
        224,
        162,
        147,
        255,
        179,
        100,
        142,
        255,
        19,
        72,
        137,
        255,
        44,
        102,
        132,
        255,
        254,
        190,
        127,
        255,
        135,
        82,
        123,
        255,
        144,
        49,
        119,
        255,
        124,
        100,
        115,
        255,
        174,
        243,
        111,
        255,
        39,
        223,
        108,
        255,
        16,
        64,
        106,
        255,
        163,
        5,
        104,
        255,
        11,
        73,
        102,
        255,
        170,
        18,
        101,
        255,
        129,
        98,
        100,
        255,
        86,
        73,
        100,
        255,
        42,
        199,
        100,
        255,
        97,
        228,
        101,
        255,
        93,
        169,
        103,
        255,
        130,
        30,
        106,
        255,
        52,
        76,
        109,
        255,
        115,
        50,
        113,
        255,
        5,
        226,
        117,
        255,
        135,
        82,
        123,
        255,
        93,
        140,
        129,
        255,
        78,
        160,
        136,
        255,
        245,
        133,
        144,
        255,
        73,
        186,
        102,
        0,
        9,
        24,
        93,
        0,
        17,
        164,
        82,
        0,
        56,
        69,
        71,
        0,
        226,
        3,
        59,
        0,
        13,
        224,
        45,
        0,
        86,
        209,
        31,
        0,
        133,
        232,
        16,
        0,
        210,
        20,
        1,
        0,
        6,
        103,
        240,
        255,
        187,
        214,
        222,
        255,
        85,
        108,
        204,
        255,
        213,
        39,
        185,
        255,
        1,
        26,
        165,
        255,
        118,
        58,
        144,
        255,
        151,
        145,
        122,
        255,
        200,
        39,
        100,
        255,
        109,
        5,
        77,
        255,
        232,
        50,
        53,
        255,
        58,
        176,
        28,
        255,
        142,
        150,
        3,
        255,
        227,
        229,
        233,
        254,
        156,
        166,
        207,
        254,
        130,
        233,
        180,
        254,
        90,
        191,
        153,
        254,
        37,
        40,
        126,
        254,
        169,
        52,
        98,
        254,
        18,
        254,
        69,
        254,
        251,
        123,
        41,
        254,
        243,
        207,
        12,
        254,
        92,
        2,
        240,
        253,
        255,
        35,
        211,
        253,
        63,
        61,
        182,
        253,
        226,
        94,
        153,
        253,
        19,
        162,
        124,
        253,
        209,
        6,
        96,
        253,
        172,
        174,
        67,
        253,
        163,
        153,
        39,
        253,
        67,
        233,
        11,
        253,
        141,
        157,
        240,
        252,
        171,
        207,
        213,
        252,
        1,
        136,
        187,
        252,
        86,
        215,
        161,
        252,
        212,
        214,
        136,
        252,
        223,
        142,
        112,
        252,
        218,
        7,
        89,
        252,
        239,
        90,
        66,
        252,
        130,
        144,
        44,
        252,
        247,
        176,
        23,
        252,
        120,
        213,
        3,
        252,
        105,
        6,
        241,
        251,
        44,
        76,
        223,
        251,
        38,
        175,
        206,
        251,
        29,
        64,
        191,
        251,
        117,
        7,
        177,
        251,
        145,
        13,
        164,
        251,
        214,
        90,
        152,
        251,
        165,
        247,
        141,
        251,
        0,
        228,
        132,
        251,
        174,
        48,
        125,
        251,
        173,
        221,
        118,
        251,
        255,
        234,
        113,
        251,
        7,
        97,
        110,
        251,
        197,
        63,
        108,
        251,
        200,
        120,
        148,
        4,
        59,
        192,
        147,
        4,
        249,
        158,
        145,
        4,
        1,
        21,
        142,
        4,
        83,
        34,
        137,
        4,
        82,
        207,
        130,
        4,
        0,
        28,
        123,
        4,
        91,
        8,
        114,
        4,
        42,
        165,
        103,
        4,
        111,
        242,
        91,
        4,
        139,
        248,
        78,
        4,
        227,
        191,
        64,
        4,
        218,
        80,
        49,
        4,
        212,
        179,
        32,
        4,
        151,
        249,
        14,
        4,
        136,
        42,
        252,
        3,
        9,
        79,
        232,
        3,
        126,
        111,
        211,
        3,
        17,
        165,
        189,
        3,
        38,
        248,
        166,
        3,
        33,
        113,
        143,
        3,
        44,
        41,
        119,
        3,
        170,
        40,
        94,
        3,
        255,
        119,
        68,
        3,
        85,
        48,
        42,
        3,
        115,
        98,
        15,
        3,
        189,
        22,
        244,
        2,
        93,
        102,
        216,
        2,
        84,
        81,
        188,
        2,
        47,
        249,
        159,
        2,
        237,
        93,
        131,
        2,
        30,
        161,
        102,
        2,
        193,
        194,
        73,
        2,
        1,
        220,
        44,
        2,
        164,
        253,
        15,
        2,
        13,
        48,
        243,
        1,
        5,
        132,
        214,
        1,
        238,
        1,
        186,
        1,
        87,
        203,
        157,
        1,
        219,
        215,
        129,
        1,
        166,
        64,
        102,
        1,
        126,
        22,
        75,
        1,
        100,
        89,
        48,
        1,
        29,
        26,
        22,
        1,
        114,
        105,
        252,
        0,
        198,
        79,
        227,
        0,
        24,
        205,
        202,
        0,
        147,
        250,
        178,
        0,
        56,
        216,
        155,
        0,
        105,
        110,
        133,
        0,
        138,
        197,
        111,
        0,
        255,
        229,
        90,
        0,
        43,
        216,
        70,
        0,
        171,
        147,
        51,
        0,
        69,
        41,
        33,
        0,
        250,
        152,
        15,
        0,
        46,
        235,
        254,
        255,
        123,
        23,
        239,
        255,
        170,
        46,
        224,
        255,
        243,
        31,
        210,
        255,
        30,
        252,
        196,
        255,
        200,
        186,
        184,
        255,
        239,
        91,
        173,
        255,
        247,
        231,
        162,
        255,
        73,
        186,
        102,
        0,
        11,
        122,
        111,
        0,
        178,
        95,
        119,
        0,
        163,
        115,
        126,
        0,
        121,
        173,
        132,
        0,
        251,
        29,
        138,
        0,
        141,
        205,
        142,
        0,
        204,
        179,
        146,
        0,
        126,
        225,
        149,
        0,
        163,
        86,
        152,
        0,
        159,
        27,
        154,
        0,
        214,
        56,
        155,
        0,
        170,
        182,
        155,
        0,
        127,
        157,
        155,
        0,
        86,
        237,
        154,
        0,
        245,
        182,
        153,
        0,
        93,
        250,
        151,
        0,
        240,
        191,
        149,
        0,
        217,
        32,
        147,
        0,
        82,
        12,
        144,
        0,
        132,
        155,
        140,
        0,
        112,
        206,
        136,
        0,
        121,
        173,
        132,
        0,
        2,
        65,
        128,
        0,
        212,
        153,
        123,
        0,
        237,
        183,
        118,
        0,
        77,
        155,
        113,
        0,
        32,
        93,
        108,
        0,
        1,
        245,
        102,
        0,
        184,
        115,
        97,
        0,
        68,
        217,
        91,
        0,
        109,
        54,
        86,
        0,
        207,
        130,
        80,
        0,
        49,
        207,
        74,
        0,
        246,
        35,
        69,
        0,
        187,
        120,
        63,
        0,
        171,
        230,
        57,
        0,
        254,
        92,
        52,
        0,
        124,
        236,
        46,
        0,
        136,
        157,
        41,
        0,
        190,
        103,
        36,
        0,
        229,
        91,
        31,
        0,
        155,
        113,
        26,
        0,
        66,
        177,
        21,
        0,
        218,
        26,
        17,
        0,
        199,
        182,
        12,
        0,
        9,
        133,
        8,
        0,
        61,
        125,
        4,
        0,
        41,
        176,
        0,
        0,
        206,
        29,
        253,
        255,
        100,
        181,
        249,
        255,
        21,
        144,
        246,
        255,
        184,
        148,
        243,
        255,
        20,
        212,
        240,
        255,
        139,
        86,
        238,
        255,
        243,
        2,
        236,
        255,
        21,
        234,
        233,
        255,
        138,
        3,
        232,
        255,
        85,
        79,
        230,
        255,
        217,
        213,
        228,
        255,
        77,
        134,
        227,
        255,
        23,
        105,
        226,
        255,
        53,
        126,
        225,
        255,
        69,
        189,
        224,
        255,
        86,
        209,
        31,
        0,
        99,
        62,
        32,
        0,
        127,
        129,
        32,
        0,
        170,
        154,
        32,
        0,
        70,
        146,
        32,
        0,
        85,
        104,
        32,
        0,
        57,
        37,
        32,
        0,
        143,
        192,
        31,
        0,
        187,
        66,
        31,
        0,
        188,
        171,
        30,
        0,
        147,
        251,
        29,
        0,
        163,
        58,
        29,
        0,
        136,
        96,
        28,
        0,
        10,
        126,
        27,
        0,
        197,
        138,
        26,
        0,
        185,
        134,
        25,
        0,
        74,
        122,
        24,
        0,
        119,
        101,
        23,
        0,
        164,
        80,
        22,
        0,
        109,
        51,
        21,
        0,
        211,
        13,
        20,
        0,
        58,
        232,
        18,
        0,
        160,
        194,
        17,
        0,
        6,
        157,
        16,
        0,
        207,
        127,
        15,
        0,
        53,
        90,
        14,
        0,
        255,
        60,
        13,
        0,
        44,
        40,
        12,
        0,
        188,
        27,
        11,
        0,
        176,
        23,
        10,
        0,
        164,
        19,
        9,
        0,
        252,
        23,
        8,
        0,
        26,
        45,
        7,
        0,
        57,
        66,
        6,
        0,
        30,
        104,
        5,
        0,
        103,
        150,
        4,
        0,
        20,
        205,
        3,
        0,
        135,
        20,
        3,
        0,
        94,
        100,
        2,
        0,
        152,
        188,
        1,
        0,
        54,
        29,
        1,
        0,
        155,
        142,
        0,
        0,
        99,
        8,
        0,
        0,
        144,
        138,
        255,
        255,
        130,
        29,
        255,
        255,
        117,
        176,
        254,
        255,
        47,
        84,
        254,
        255,
        76,
        0,
        254,
        255,
        205,
        180,
        253,
        255,
        177,
        113,
        253,
        255,
        92,
        63,
        253,
        255,
        7,
        13,
        253,
        255,
        22,
        227,
        252,
        255,
        136,
        193,
        252,
        255,
        250,
        159,
        252,
        255,
        51,
        143,
        252,
        255,
        108,
        126,
        252,
        255,
        8,
        118,
        252,
        255,
        165,
        109,
        252,
        255,
        165,
        109,
        252,
        255,
        8,
        118,
        252,
        255,
        108,
        126,
        252,
        255,
        207,
        134,
        252,
        255,
        150,
        151,
        252,
        255,
        163,
        87,
        3,
        0,
        120,
        62,
        3,
        0,
        78,
        37,
        3,
        0,
        35,
        12,
        3,
        0,
        93,
        251,
        2,
        0,
        207,
        217,
        2,
        0,
        164,
        192,
        2,
        0,
        122,
        167,
        2,
        0,
        236,
        133,
        2,
        0,
        94,
        100,
        2,
        0,
        51,
        75,
        2,
        0,
        165,
        41,
        2,
        0,
        123,
        16,
        2,
        0,
        81,
        247,
        1,
        0,
        195,
        213,
        1,
        0,
        152,
        188,
        1,
        0,
        110,
        163,
        1,
        0,
        224,
        129,
        1,
        0,
        181,
        104,
        1,
        0,
        238,
        87,
        1,
        0,
        196,
        62,
        1,
        0,
        153,
        37,
        1,
        0,
        111,
        12,
        1,
        0,
        168,
        251,
        0,
        0,
        225,
        234,
        0,
        0,
        183,
        209,
        0,
        0,
        240,
        192,
        0,
        0,
        41,
        176,
        0,
        0,
        197,
        167,
        0,
        0,
        254,
        150,
        0,
        0,
        155,
        142,
        0,
        0,
        212,
        125,
        0,
        0,
        112,
        117,
        0,
        0,
        169,
        100,
        0,
        0,
        70,
        92,
        0,
        0,
        226,
        83,
        0,
        0,
        127,
        75,
        0,
        0,
        27,
        67,
        0,
        0,
        27,
        67,
        0,
        0,
        184,
        58,
        0,
        0,
        84,
        50,
        0,
        0,
        241,
        41,
        0,
        0,
        241,
        41,
        0,
        0,
        141,
        33,
        0,
        0,
        141,
        33,
        0,
        0,
        42,
        25,
        0,
        0,
        42,
        25,
        0,
        0,
        42,
        25,
        0,
        0,
        198,
        16,
        0,
        0,
        198,
        16,
        0,
        0,
        198,
        16,
        0,
        0,
        198,
        16,
        0,
        0,
        99,
        8,
        0,
        0,
        99,
        8,
        0,
        0,
        99,
        8,
        0,
        0,
        99,
        8,
        0,
        0,
        99,
        8,
        0,
        0,
        99,
        8,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        24,
        35,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        52,
        37,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        10,
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        232,
        17,
        0,
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        2,
        0,
        1,
        0,
        3,
        0,
        1,
        0,
        1,
        0,
        3,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        2,
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        3,
        0,
        2,
        0,
        0,
        0,
        1,
        0,
        2,
        0,
        6,
        0,
        5,
        0,
        3,
        0,
        1,
        0,
        4,
        0,
        4,
        0,
        7,
        0,
        5,
        0,
        7,
        0,
        1,
        0,
        6,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        7,
        0,
        3,
        0,
        5,
        0,
        1,
        0,
        6,
        0,
        2,
        0,
        3,
        0,
        2,
        0,
        5,
        0,
        4,
        0,
        4,
        0,
        1,
        0,
        3,
        0,
        3,
        0,
        2,
        0,
        0,
        0,
        1,
        0,
        2,
        0,
        10,
        0,
        19,
        0,
        16,
        0,
        10,
        0,
        3,
        0,
        3,
        0,
        7,
        0,
        10,
        0,
        5,
        0,
        3,
        0,
        11,
        0,
        4,
        0,
        13,
        0,
        17,
        0,
        8,
        0,
        4,
        0,
        12,
        0,
        11,
        0,
        18,
        0,
        15,
        0,
        11,
        0,
        2,
        0,
        7,
        0,
        6,
        0,
        9,
        0,
        14,
        0,
        3,
        0,
        1,
        0,
        6,
        0,
        4,
        0,
        5,
        0,
        3,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        4,
        0,
        6,
        0,
        18,
        0,
        12,
        0,
        5,
        0,
        5,
        0,
        1,
        0,
        2,
        0,
        16,
        0,
        9,
        0,
        3,
        0,
        7,
        0,
        3,
        0,
        5,
        0,
        14,
        0,
        7,
        0,
        3,
        0,
        19,
        0,
        17,
        0,
        15,
        0,
        13,
        0,
        10,
        0,
        4,
        0,
        13,
        0,
        5,
        0,
        8,
        0,
        11,
        0,
        5,
        0,
        1,
        0,
        12,
        0,
        4,
        0,
        4,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        7,
        0,
        5,
        0,
        9,
        0,
        14,
        0,
        15,
        0,
        7,
        0,
        6,
        0,
        4,
        0,
        5,
        0,
        5,
        0,
        6,
        0,
        7,
        0,
        7,
        0,
        6,
        0,
        8,
        0,
        8,
        0,
        8,
        0,
        5,
        0,
        15,
        0,
        6,
        0,
        9,
        0,
        10,
        0,
        5,
        0,
        1,
        0,
        11,
        0,
        7,
        0,
        9,
        0,
        6,
        0,
        4,
        0,
        1,
        0,
        14,
        0,
        4,
        0,
        6,
        0,
        2,
        0,
        6,
        0,
        0,
        0,
        1,
        0,
        2,
        0,
        10,
        0,
        23,
        0,
        35,
        0,
        30,
        0,
        12,
        0,
        17,
        0,
        3,
        0,
        3,
        0,
        8,
        0,
        12,
        0,
        18,
        0,
        21,
        0,
        12,
        0,
        7,
        0,
        11,
        0,
        9,
        0,
        15,
        0,
        21,
        0,
        32,
        0,
        40,
        0,
        19,
        0,
        6,
        0,
        14,
        0,
        13,
        0,
        22,
        0,
        34,
        0,
        46,
        0,
        23,
        0,
        18,
        0,
        7,
        0,
        20,
        0,
        19,
        0,
        33,
        0,
        47,
        0,
        27,
        0,
        22,
        0,
        9,
        0,
        3,
        0,
        31,
        0,
        22,
        0,
        41,
        0,
        26,
        0,
        21,
        0,
        20,
        0,
        5,
        0,
        3,
        0,
        14,
        0,
        13,
        0,
        10,
        0,
        11,
        0,
        16,
        0,
        6,
        0,
        5,
        0,
        1,
        0,
        9,
        0,
        8,
        0,
        7,
        0,
        8,
        0,
        4,
        0,
        4,
        0,
        2,
        0,
        0,
        0,
        3,
        0,
        4,
        0,
        10,
        0,
        24,
        0,
        34,
        0,
        33,
        0,
        21,
        0,
        15,
        0,
        5,
        0,
        3,
        0,
        4,
        0,
        10,
        0,
        32,
        0,
        17,
        0,
        11,
        0,
        10,
        0,
        11,
        0,
        7,
        0,
        13,
        0,
        18,
        0,
        30,
        0,
        31,
        0,
        20,
        0,
        5,
        0,
        25,
        0,
        11,
        0,
        19,
        0,
        59,
        0,
        27,
        0,
        18,
        0,
        12,
        0,
        5,
        0,
        35,
        0,
        33,
        0,
        31,
        0,
        58,
        0,
        30,
        0,
        16,
        0,
        7,
        0,
        5,
        0,
        28,
        0,
        26,
        0,
        32,
        0,
        19,
        0,
        17,
        0,
        15,
        0,
        8,
        0,
        14,
        0,
        14,
        0,
        12,
        0,
        9,
        0,
        13,
        0,
        14,
        0,
        9,
        0,
        4,
        0,
        1,
        0,
        11,
        0,
        4,
        0,
        6,
        0,
        6,
        0,
        6,
        0,
        3,
        0,
        2,
        0,
        0,
        0,
        9,
        0,
        6,
        0,
        16,
        0,
        33,
        0,
        41,
        0,
        39,
        0,
        38,
        0,
        26,
        0,
        7,
        0,
        5,
        0,
        6,
        0,
        9,
        0,
        23,
        0,
        16,
        0,
        26,
        0,
        11,
        0,
        17,
        0,
        7,
        0,
        11,
        0,
        14,
        0,
        21,
        0,
        30,
        0,
        10,
        0,
        7,
        0,
        17,
        0,
        10,
        0,
        15,
        0,
        12,
        0,
        18,
        0,
        28,
        0,
        14,
        0,
        5,
        0,
        32,
        0,
        13,
        0,
        22,
        0,
        19,
        0,
        18,
        0,
        16,
        0,
        9,
        0,
        5,
        0,
        40,
        0,
        17,
        0,
        31,
        0,
        29,
        0,
        17,
        0,
        13,
        0,
        4,
        0,
        2,
        0,
        27,
        0,
        12,
        0,
        11,
        0,
        15,
        0,
        10,
        0,
        7,
        0,
        4,
        0,
        1,
        0,
        27,
        0,
        12,
        0,
        8,
        0,
        12,
        0,
        6,
        0,
        3,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        5,
        0,
        14,
        0,
        21,
        0,
        34,
        0,
        51,
        0,
        46,
        0,
        71,
        0,
        42,
        0,
        52,
        0,
        68,
        0,
        52,
        0,
        67,
        0,
        44,
        0,
        43,
        0,
        19,
        0,
        3,
        0,
        4,
        0,
        12,
        0,
        19,
        0,
        31,
        0,
        26,
        0,
        44,
        0,
        33,
        0,
        31,
        0,
        24,
        0,
        32,
        0,
        24,
        0,
        31,
        0,
        35,
        0,
        22,
        0,
        14,
        0,
        15,
        0,
        13,
        0,
        23,
        0,
        36,
        0,
        59,
        0,
        49,
        0,
        77,
        0,
        65,
        0,
        29,
        0,
        40,
        0,
        30,
        0,
        40,
        0,
        27,
        0,
        33,
        0,
        42,
        0,
        16,
        0,
        22,
        0,
        20,
        0,
        37,
        0,
        61,
        0,
        56,
        0,
        79,
        0,
        73,
        0,
        64,
        0,
        43,
        0,
        76,
        0,
        56,
        0,
        37,
        0,
        26,
        0,
        31,
        0,
        25,
        0,
        14,
        0,
        35,
        0,
        16,
        0,
        60,
        0,
        57,
        0,
        97,
        0,
        75,
        0,
        114,
        0,
        91,
        0,
        54,
        0,
        73,
        0,
        55,
        0,
        41,
        0,
        48,
        0,
        53,
        0,
        23,
        0,
        24,
        0,
        58,
        0,
        27,
        0,
        50,
        0,
        96,
        0,
        76,
        0,
        70,
        0,
        93,
        0,
        84,
        0,
        77,
        0,
        58,
        0,
        79,
        0,
        29,
        0,
        74,
        0,
        49,
        0,
        41,
        0,
        17,
        0,
        47,
        0,
        45,
        0,
        78,
        0,
        74,
        0,
        115,
        0,
        94,
        0,
        90,
        0,
        79,
        0,
        69,
        0,
        83,
        0,
        71,
        0,
        50,
        0,
        59,
        0,
        38,
        0,
        36,
        0,
        15,
        0,
        72,
        0,
        34,
        0,
        56,
        0,
        95,
        0,
        92,
        0,
        85,
        0,
        91,
        0,
        90,
        0,
        86,
        0,
        73,
        0,
        77,
        0,
        65,
        0,
        51,
        0,
        44,
        0,
        43,
        0,
        42,
        0,
        43,
        0,
        20,
        0,
        30,
        0,
        44,
        0,
        55,
        0,
        78,
        0,
        72,
        0,
        87,
        0,
        78,
        0,
        61,
        0,
        46,
        0,
        54,
        0,
        37,
        0,
        30,
        0,
        20,
        0,
        16,
        0,
        53,
        0,
        25,
        0,
        41,
        0,
        37,
        0,
        44,
        0,
        59,
        0,
        54,
        0,
        81,
        0,
        66,
        0,
        76,
        0,
        57,
        0,
        54,
        0,
        37,
        0,
        18,
        0,
        39,
        0,
        11,
        0,
        35,
        0,
        33,
        0,
        31,
        0,
        57,
        0,
        42,
        0,
        82,
        0,
        72,
        0,
        80,
        0,
        47,
        0,
        58,
        0,
        55,
        0,
        21,
        0,
        22,
        0,
        26,
        0,
        38,
        0,
        22,
        0,
        53,
        0,
        25,
        0,
        23,
        0,
        38,
        0,
        70,
        0,
        60,
        0,
        51,
        0,
        36,
        0,
        55,
        0,
        26,
        0,
        34,
        0,
        23,
        0,
        27,
        0,
        14,
        0,
        9,
        0,
        7,
        0,
        34,
        0,
        32,
        0,
        28,
        0,
        39,
        0,
        49,
        0,
        75,
        0,
        30,
        0,
        52,
        0,
        48,
        0,
        40,
        0,
        52,
        0,
        28,
        0,
        18,
        0,
        17,
        0,
        9,
        0,
        5,
        0,
        45,
        0,
        21,
        0,
        34,
        0,
        64,
        0,
        56,
        0,
        50,
        0,
        49,
        0,
        45,
        0,
        31,
        0,
        19,
        0,
        12,
        0,
        15,
        0,
        10,
        0,
        7,
        0,
        6,
        0,
        3,
        0,
        48,
        0,
        23,
        0,
        20,
        0,
        39,
        0,
        36,
        0,
        35,
        0,
        53,
        0,
        21,
        0,
        16,
        0,
        23,
        0,
        13,
        0,
        10,
        0,
        6,
        0,
        1,
        0,
        4,
        0,
        2,
        0,
        16,
        0,
        15,
        0,
        17,
        0,
        27,
        0,
        25,
        0,
        20,
        0,
        29,
        0,
        11,
        0,
        17,
        0,
        12,
        0,
        16,
        0,
        8,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        7,
        0,
        12,
        0,
        18,
        0,
        53,
        0,
        47,
        0,
        76,
        0,
        124,
        0,
        108,
        0,
        89,
        0,
        123,
        0,
        108,
        0,
        119,
        0,
        107,
        0,
        81,
        0,
        122,
        0,
        63,
        0,
        13,
        0,
        5,
        0,
        16,
        0,
        27,
        0,
        46,
        0,
        36,
        0,
        61,
        0,
        51,
        0,
        42,
        0,
        70,
        0,
        52,
        0,
        83,
        0,
        65,
        0,
        41,
        0,
        59,
        0,
        36,
        0,
        19,
        0,
        17,
        0,
        15,
        0,
        24,
        0,
        41,
        0,
        34,
        0,
        59,
        0,
        48,
        0,
        40,
        0,
        64,
        0,
        50,
        0,
        78,
        0,
        62,
        0,
        80,
        0,
        56,
        0,
        33,
        0,
        29,
        0,
        28,
        0,
        25,
        0,
        43,
        0,
        39,
        0,
        63,
        0,
        55,
        0,
        93,
        0,
        76,
        0,
        59,
        0,
        93,
        0,
        72,
        0,
        54,
        0,
        75,
        0,
        50,
        0,
        29,
        0,
        52,
        0,
        22,
        0,
        42,
        0,
        40,
        0,
        67,
        0,
        57,
        0,
        95,
        0,
        79,
        0,
        72,
        0,
        57,
        0,
        89,
        0,
        69,
        0,
        49,
        0,
        66,
        0,
        46,
        0,
        27,
        0,
        77,
        0,
        37,
        0,
        35,
        0,
        66,
        0,
        58,
        0,
        52,
        0,
        91,
        0,
        74,
        0,
        62,
        0,
        48,
        0,
        79,
        0,
        63,
        0,
        90,
        0,
        62,
        0,
        40,
        0,
        38,
        0,
        125,
        0,
        32,
        0,
        60,
        0,
        56,
        0,
        50,
        0,
        92,
        0,
        78,
        0,
        65,
        0,
        55,
        0,
        87,
        0,
        71,
        0,
        51,
        0,
        73,
        0,
        51,
        0,
        70,
        0,
        30,
        0,
        109,
        0,
        53,
        0,
        49,
        0,
        94,
        0,
        88,
        0,
        75,
        0,
        66,
        0,
        122,
        0,
        91,
        0,
        73,
        0,
        56,
        0,
        42,
        0,
        64,
        0,
        44,
        0,
        21,
        0,
        25,
        0,
        90,
        0,
        43,
        0,
        41,
        0,
        77,
        0,
        73,
        0,
        63,
        0,
        56,
        0,
        92,
        0,
        77,
        0,
        66,
        0,
        47,
        0,
        67,
        0,
        48,
        0,
        53,
        0,
        36,
        0,
        20,
        0,
        71,
        0,
        34,
        0,
        67,
        0,
        60,
        0,
        58,
        0,
        49,
        0,
        88,
        0,
        76,
        0,
        67,
        0,
        106,
        0,
        71,
        0,
        54,
        0,
        38,
        0,
        39,
        0,
        23,
        0,
        15,
        0,
        109,
        0,
        53,
        0,
        51,
        0,
        47,
        0,
        90,
        0,
        82,
        0,
        58,
        0,
        57,
        0,
        48,
        0,
        72,
        0,
        57,
        0,
        41,
        0,
        23,
        0,
        27,
        0,
        62,
        0,
        9,
        0,
        86,
        0,
        42,
        0,
        40,
        0,
        37,
        0,
        70,
        0,
        64,
        0,
        52,
        0,
        43,
        0,
        70,
        0,
        55,
        0,
        42,
        0,
        25,
        0,
        29,
        0,
        18,
        0,
        11,
        0,
        11,
        0,
        118,
        0,
        68,
        0,
        30,
        0,
        55,
        0,
        50,
        0,
        46,
        0,
        74,
        0,
        65,
        0,
        49,
        0,
        39,
        0,
        24,
        0,
        16,
        0,
        22,
        0,
        13,
        0,
        14,
        0,
        7,
        0,
        91,
        0,
        44,
        0,
        39,
        0,
        38,
        0,
        34,
        0,
        63,
        0,
        52,
        0,
        45,
        0,
        31,
        0,
        52,
        0,
        28,
        0,
        19,
        0,
        14,
        0,
        8,
        0,
        9,
        0,
        3,
        0,
        123,
        0,
        60,
        0,
        58,
        0,
        53,
        0,
        47,
        0,
        43,
        0,
        32,
        0,
        22,
        0,
        37,
        0,
        24,
        0,
        17,
        0,
        12,
        0,
        15,
        0,
        10,
        0,
        2,
        0,
        1,
        0,
        71,
        0,
        37,
        0,
        34,
        0,
        30,
        0,
        28,
        0,
        20,
        0,
        17,
        0,
        26,
        0,
        21,
        0,
        16,
        0,
        10,
        0,
        6,
        0,
        8,
        0,
        6,
        0,
        2,
        0,
        0,
        0,
        1,
        0,
        5,
        0,
        14,
        0,
        44,
        0,
        74,
        0,
        63,
        0,
        110,
        0,
        93,
        0,
        172,
        0,
        149,
        0,
        138,
        0,
        242,
        0,
        225,
        0,
        195,
        0,
        120,
        1,
        17,
        0,
        3,
        0,
        4,
        0,
        12,
        0,
        20,
        0,
        35,
        0,
        62,
        0,
        53,
        0,
        47,
        0,
        83,
        0,
        75,
        0,
        68,
        0,
        119,
        0,
        201,
        0,
        107,
        0,
        207,
        0,
        9,
        0,
        15,
        0,
        13,
        0,
        23,
        0,
        38,
        0,
        67,
        0,
        58,
        0,
        103,
        0,
        90,
        0,
        161,
        0,
        72,
        0,
        127,
        0,
        117,
        0,
        110,
        0,
        209,
        0,
        206,
        0,
        16,
        0,
        45,
        0,
        21,
        0,
        39,
        0,
        69,
        0,
        64,
        0,
        114,
        0,
        99,
        0,
        87,
        0,
        158,
        0,
        140,
        0,
        252,
        0,
        212,
        0,
        199,
        0,
        131,
        1,
        109,
        1,
        26,
        0,
        75,
        0,
        36,
        0,
        68,
        0,
        65,
        0,
        115,
        0,
        101,
        0,
        179,
        0,
        164,
        0,
        155,
        0,
        8,
        1,
        246,
        0,
        226,
        0,
        139,
        1,
        126,
        1,
        106,
        1,
        9,
        0,
        66,
        0,
        30,
        0,
        59,
        0,
        56,
        0,
        102,
        0,
        185,
        0,
        173,
        0,
        9,
        1,
        142,
        0,
        253,
        0,
        232,
        0,
        144,
        1,
        132,
        1,
        122,
        1,
        189,
        1,
        16,
        0,
        111,
        0,
        54,
        0,
        52,
        0,
        100,
        0,
        184,
        0,
        178,
        0,
        160,
        0,
        133,
        0,
        1,
        1,
        244,
        0,
        228,
        0,
        217,
        0,
        129,
        1,
        110,
        1,
        203,
        2,
        10,
        0,
        98,
        0,
        48,
        0,
        91,
        0,
        88,
        0,
        165,
        0,
        157,
        0,
        148,
        0,
        5,
        1,
        248,
        0,
        151,
        1,
        141,
        1,
        116,
        1,
        124,
        1,
        121,
        3,
        116,
        3,
        8,
        0,
        85,
        0,
        84,
        0,
        81,
        0,
        159,
        0,
        156,
        0,
        143,
        0,
        4,
        1,
        249,
        0,
        171,
        1,
        145,
        1,
        136,
        1,
        127,
        1,
        215,
        2,
        201,
        2,
        196,
        2,
        7,
        0,
        154,
        0,
        76,
        0,
        73,
        0,
        141,
        0,
        131,
        0,
        0,
        1,
        245,
        0,
        170,
        1,
        150,
        1,
        138,
        1,
        128,
        1,
        223,
        2,
        103,
        1,
        198,
        2,
        96,
        1,
        11,
        0,
        139,
        0,
        129,
        0,
        67,
        0,
        125,
        0,
        247,
        0,
        233,
        0,
        229,
        0,
        219,
        0,
        137,
        1,
        231,
        2,
        225,
        2,
        208,
        2,
        117,
        3,
        114,
        3,
        183,
        1,
        4,
        0,
        243,
        0,
        120,
        0,
        118,
        0,
        115,
        0,
        227,
        0,
        223,
        0,
        140,
        1,
        234,
        2,
        230,
        2,
        224,
        2,
        209,
        2,
        200,
        2,
        194,
        2,
        223,
        0,
        180,
        1,
        6,
        0,
        202,
        0,
        224,
        0,
        222,
        0,
        218,
        0,
        216,
        0,
        133,
        1,
        130,
        1,
        125,
        1,
        108,
        1,
        120,
        3,
        187,
        1,
        195,
        2,
        184,
        1,
        181,
        1,
        192,
        6,
        4,
        0,
        235,
        2,
        211,
        0,
        210,
        0,
        208,
        0,
        114,
        1,
        123,
        1,
        222,
        2,
        211,
        2,
        202,
        2,
        199,
        6,
        115,
        3,
        109,
        3,
        108,
        3,
        131,
        13,
        97,
        3,
        2,
        0,
        121,
        1,
        113,
        1,
        102,
        0,
        187,
        0,
        214,
        2,
        210,
        2,
        102,
        1,
        199,
        2,
        197,
        2,
        98,
        3,
        198,
        6,
        103,
        3,
        130,
        13,
        102,
        3,
        178,
        1,
        0,
        0,
        12,
        0,
        10,
        0,
        7,
        0,
        11,
        0,
        10,
        0,
        17,
        0,
        11,
        0,
        9,
        0,
        13,
        0,
        12,
        0,
        10,
        0,
        7,
        0,
        5,
        0,
        3,
        0,
        1,
        0,
        3,
        0,
        15,
        0,
        13,
        0,
        46,
        0,
        80,
        0,
        146,
        0,
        6,
        1,
        248,
        0,
        178,
        1,
        170,
        1,
        157,
        2,
        141,
        2,
        137,
        2,
        109,
        2,
        5,
        2,
        8,
        4,
        88,
        0,
        14,
        0,
        12,
        0,
        21,
        0,
        38,
        0,
        71,
        0,
        130,
        0,
        122,
        0,
        216,
        0,
        209,
        0,
        198,
        0,
        71,
        1,
        89,
        1,
        63,
        1,
        41,
        1,
        23,
        1,
        42,
        0,
        47,
        0,
        22,
        0,
        41,
        0,
        74,
        0,
        68,
        0,
        128,
        0,
        120,
        0,
        221,
        0,
        207,
        0,
        194,
        0,
        182,
        0,
        84,
        1,
        59,
        1,
        39,
        1,
        29,
        2,
        18,
        0,
        81,
        0,
        39,
        0,
        75,
        0,
        70,
        0,
        134,
        0,
        125,
        0,
        116,
        0,
        220,
        0,
        204,
        0,
        190,
        0,
        178,
        0,
        69,
        1,
        55,
        1,
        37,
        1,
        15,
        1,
        16,
        0,
        147,
        0,
        72,
        0,
        69,
        0,
        135,
        0,
        127,
        0,
        118,
        0,
        112,
        0,
        210,
        0,
        200,
        0,
        188,
        0,
        96,
        1,
        67,
        1,
        50,
        1,
        29,
        1,
        28,
        2,
        14,
        0,
        7,
        1,
        66,
        0,
        129,
        0,
        126,
        0,
        119,
        0,
        114,
        0,
        214,
        0,
        202,
        0,
        192,
        0,
        180,
        0,
        85,
        1,
        61,
        1,
        45,
        1,
        25,
        1,
        6,
        1,
        12,
        0,
        249,
        0,
        123,
        0,
        121,
        0,
        117,
        0,
        113,
        0,
        215,
        0,
        206,
        0,
        195,
        0,
        185,
        0,
        91,
        1,
        74,
        1,
        52,
        1,
        35,
        1,
        16,
        1,
        8,
        2,
        10,
        0,
        179,
        1,
        115,
        0,
        111,
        0,
        109,
        0,
        211,
        0,
        203,
        0,
        196,
        0,
        187,
        0,
        97,
        1,
        76,
        1,
        57,
        1,
        42,
        1,
        27,
        1,
        19,
        2,
        125,
        1,
        17,
        0,
        171,
        1,
        212,
        0,
        208,
        0,
        205,
        0,
        201,
        0,
        193,
        0,
        186,
        0,
        177,
        0,
        169,
        0,
        64,
        1,
        47,
        1,
        30,
        1,
        12,
        1,
        2,
        2,
        121,
        1,
        16,
        0,
        79,
        1,
        199,
        0,
        197,
        0,
        191,
        0,
        189,
        0,
        181,
        0,
        174,
        0,
        77,
        1,
        65,
        1,
        49,
        1,
        33,
        1,
        19,
        1,
        9,
        2,
        123,
        1,
        115,
        1,
        11,
        0,
        156,
        2,
        184,
        0,
        183,
        0,
        179,
        0,
        175,
        0,
        88,
        1,
        75,
        1,
        58,
        1,
        48,
        1,
        34,
        1,
        21,
        1,
        18,
        2,
        127,
        1,
        117,
        1,
        110,
        1,
        10,
        0,
        140,
        2,
        90,
        1,
        171,
        0,
        168,
        0,
        164,
        0,
        62,
        1,
        53,
        1,
        43,
        1,
        31,
        1,
        20,
        1,
        7,
        1,
        1,
        2,
        119,
        1,
        112,
        1,
        106,
        1,
        6,
        0,
        136,
        2,
        66,
        1,
        60,
        1,
        56,
        1,
        51,
        1,
        46,
        1,
        36,
        1,
        28,
        1,
        13,
        1,
        5,
        1,
        0,
        2,
        120,
        1,
        114,
        1,
        108,
        1,
        103,
        1,
        4,
        0,
        108,
        2,
        44,
        1,
        40,
        1,
        38,
        1,
        32,
        1,
        26,
        1,
        17,
        1,
        10,
        1,
        3,
        2,
        124,
        1,
        118,
        1,
        113,
        1,
        109,
        1,
        105,
        1,
        101,
        1,
        2,
        0,
        9,
        4,
        24,
        1,
        22,
        1,
        18,
        1,
        11,
        1,
        8,
        1,
        3,
        1,
        126,
        1,
        122,
        1,
        116,
        1,
        111,
        1,
        107,
        1,
        104,
        1,
        102,
        1,
        100,
        1,
        0,
        0,
        43,
        0,
        20,
        0,
        19,
        0,
        17,
        0,
        15,
        0,
        13,
        0,
        11,
        0,
        9,
        0,
        7,
        0,
        6,
        0,
        4,
        0,
        7,
        0,
        5,
        0,
        3,
        0,
        1,
        0,
        3,
        0,
        1,
        0,
        5,
        0,
        4,
        0,
        5,
        0,
        6,
        0,
        5,
        0,
        4,
        0,
        4,
        0,
        7,
        0,
        3,
        0,
        6,
        0,
        0,
        0,
        7,
        0,
        2,
        0,
        3,
        0,
        1,
        0,
        15,
        0,
        14,
        0,
        13,
        0,
        12,
        0,
        11,
        0,
        10,
        0,
        9,
        0,
        8,
        0,
        7,
        0,
        6,
        0,
        5,
        0,
        4,
        0,
        3,
        0,
        2,
        0,
        1,
        0,
        0,
        0,
        1,
        3,
        2,
        3,
        1,
        3,
        6,
        3,
        3,
        5,
        5,
        5,
        6,
        2,
        2,
        6,
        3,
        2,
        5,
        5,
        5,
        6,
        1,
        3,
        6,
        7,
        3,
        3,
        6,
        7,
        6,
        6,
        7,
        8,
        7,
        6,
        7,
        8,
        3,
        3,
        5,
        7,
        3,
        2,
        4,
        5,
        4,
        4,
        5,
        6,
        6,
        5,
        6,
        7,
        1,
        3,
        6,
        8,
        8,
        9,
        3,
        4,
        6,
        7,
        7,
        8,
        6,
        5,
        7,
        8,
        8,
        9,
        7,
        7,
        8,
        9,
        9,
        9,
        7,
        7,
        8,
        9,
        9,
        10,
        8,
        8,
        9,
        10,
        10,
        10,
        2,
        3,
        6,
        8,
        8,
        9,
        3,
        2,
        4,
        8,
        8,
        8,
        6,
        4,
        6,
        8,
        8,
        9,
        8,
        8,
        8,
        9,
        9,
        10,
        8,
        7,
        8,
        9,
        10,
        10,
        9,
        8,
        9,
        9,
        11,
        11,
        3,
        3,
        5,
        6,
        8,
        9,
        3,
        3,
        4,
        5,
        6,
        8,
        4,
        4,
        5,
        6,
        7,
        8,
        6,
        5,
        6,
        7,
        7,
        8,
        7,
        6,
        7,
        7,
        8,
        9,
        8,
        7,
        8,
        8,
        9,
        9,
        1,
        3,
        6,
        8,
        9,
        9,
        9,
        10,
        3,
        4,
        6,
        7,
        8,
        9,
        8,
        8,
        6,
        6,
        7,
        8,
        9,
        10,
        9,
        9,
        7,
        7,
        8,
        9,
        10,
        10,
        9,
        10,
        8,
        8,
        9,
        10,
        10,
        10,
        10,
        10,
        9,
        9,
        10,
        10,
        11,
        11,
        10,
        11,
        8,
        8,
        9,
        10,
        10,
        10,
        11,
        11,
        9,
        8,
        9,
        10,
        10,
        11,
        11,
        11,
        2,
        3,
        5,
        7,
        8,
        9,
        8,
        9,
        3,
        3,
        4,
        6,
        8,
        8,
        7,
        8,
        5,
        5,
        6,
        7,
        8,
        9,
        8,
        8,
        7,
        6,
        7,
        9,
        8,
        10,
        8,
        9,
        8,
        8,
        8,
        9,
        9,
        10,
        9,
        10,
        8,
        8,
        9,
        10,
        10,
        11,
        10,
        11,
        8,
        7,
        7,
        8,
        9,
        10,
        10,
        10,
        8,
        7,
        8,
        9,
        10,
        10,
        10,
        10,
        4,
        3,
        5,
        7,
        8,
        9,
        9,
        9,
        3,
        3,
        4,
        5,
        7,
        7,
        8,
        8,
        5,
        4,
        5,
        6,
        7,
        8,
        7,
        8,
        6,
        5,
        6,
        6,
        7,
        8,
        8,
        8,
        7,
        6,
        7,
        7,
        8,
        8,
        8,
        9,
        8,
        7,
        8,
        8,
        8,
        9,
        8,
        9,
        8,
        7,
        7,
        8,
        8,
        9,
        9,
        10,
        9,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        1,
        4,
        6,
        7,
        8,
        9,
        9,
        10,
        9,
        10,
        11,
        11,
        12,
        12,
        13,
        13,
        3,
        4,
        6,
        7,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        11,
        12,
        12,
        12,
        6,
        6,
        7,
        8,
        9,
        9,
        10,
        10,
        9,
        10,
        10,
        11,
        11,
        12,
        13,
        13,
        7,
        7,
        8,
        9,
        9,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        12,
        13,
        13,
        8,
        7,
        9,
        9,
        10,
        10,
        11,
        11,
        10,
        11,
        11,
        12,
        12,
        13,
        13,
        14,
        9,
        8,
        9,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        12,
        11,
        13,
        13,
        14,
        14,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        13,
        13,
        14,
        14,
        10,
        9,
        10,
        11,
        11,
        11,
        12,
        12,
        12,
        12,
        13,
        13,
        13,
        14,
        16,
        16,
        9,
        8,
        9,
        10,
        10,
        11,
        11,
        12,
        12,
        12,
        12,
        13,
        13,
        14,
        15,
        15,
        10,
        9,
        10,
        10,
        11,
        11,
        11,
        13,
        12,
        13,
        13,
        14,
        14,
        14,
        16,
        15,
        10,
        10,
        10,
        11,
        11,
        12,
        12,
        13,
        12,
        13,
        14,
        13,
        14,
        15,
        16,
        17,
        11,
        10,
        10,
        11,
        12,
        12,
        12,
        12,
        13,
        13,
        13,
        14,
        15,
        15,
        15,
        16,
        11,
        11,
        11,
        12,
        12,
        13,
        12,
        13,
        14,
        14,
        15,
        15,
        15,
        16,
        16,
        16,
        12,
        11,
        12,
        13,
        13,
        13,
        14,
        14,
        14,
        14,
        14,
        15,
        16,
        15,
        16,
        16,
        13,
        12,
        12,
        13,
        13,
        13,
        15,
        14,
        14,
        17,
        15,
        15,
        15,
        17,
        16,
        16,
        12,
        12,
        13,
        14,
        14,
        14,
        15,
        14,
        15,
        15,
        16,
        16,
        19,
        18,
        19,
        16,
        3,
        4,
        5,
        7,
        7,
        8,
        9,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        12,
        13,
        4,
        3,
        5,
        6,
        7,
        7,
        8,
        8,
        8,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        5,
        5,
        5,
        6,
        7,
        7,
        8,
        8,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        6,
        6,
        6,
        7,
        7,
        8,
        8,
        9,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        11,
        7,
        6,
        7,
        7,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        11,
        8,
        7,
        7,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        12,
        9,
        7,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        12,
        12,
        9,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        12,
        9,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        11,
        11,
        12,
        12,
        12,
        9,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        10,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        12,
        13,
        12,
        10,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        13,
        11,
        10,
        9,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        11,
        12,
        12,
        13,
        13,
        11,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        12,
        12,
        13,
        13,
        12,
        11,
        11,
        11,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        12,
        13,
        13,
        12,
        13,
        12,
        11,
        11,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        12,
        12,
        13,
        13,
        13,
        13,
        1,
        4,
        6,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        12,
        12,
        12,
        13,
        9,
        3,
        4,
        6,
        7,
        8,
        9,
        9,
        9,
        10,
        10,
        10,
        11,
        12,
        11,
        12,
        8,
        6,
        6,
        7,
        8,
        9,
        9,
        10,
        10,
        11,
        10,
        11,
        11,
        11,
        12,
        12,
        9,
        8,
        7,
        8,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        12,
        12,
        12,
        13,
        13,
        10,
        9,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        12,
        12,
        12,
        13,
        13,
        13,
        9,
        9,
        8,
        9,
        9,
        10,
        11,
        11,
        12,
        11,
        12,
        12,
        13,
        13,
        13,
        14,
        10,
        10,
        9,
        9,
        10,
        11,
        11,
        11,
        11,
        12,
        12,
        12,
        12,
        13,
        13,
        14,
        10,
        10,
        9,
        10,
        10,
        11,
        11,
        11,
        12,
        12,
        13,
        13,
        13,
        13,
        15,
        15,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        12,
        12,
        13,
        13,
        13,
        13,
        14,
        14,
        14,
        10,
        11,
        10,
        10,
        11,
        11,
        12,
        12,
        13,
        13,
        13,
        13,
        14,
        13,
        14,
        13,
        11,
        11,
        11,
        10,
        11,
        12,
        12,
        12,
        12,
        13,
        14,
        14,
        14,
        15,
        15,
        14,
        10,
        12,
        11,
        11,
        11,
        12,
        12,
        13,
        14,
        14,
        14,
        14,
        14,
        14,
        13,
        14,
        11,
        12,
        12,
        12,
        12,
        12,
        13,
        13,
        13,
        13,
        15,
        14,
        14,
        14,
        14,
        16,
        11,
        14,
        12,
        12,
        12,
        13,
        13,
        14,
        14,
        14,
        16,
        15,
        15,
        15,
        17,
        15,
        11,
        13,
        13,
        11,
        12,
        14,
        14,
        13,
        14,
        14,
        15,
        16,
        15,
        17,
        15,
        14,
        11,
        9,
        8,
        8,
        9,
        9,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        11,
        11,
        8,
        4,
        4,
        6,
        7,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        12,
        9,
        4,
        4,
        5,
        6,
        7,
        8,
        8,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        8,
        6,
        5,
        6,
        7,
        7,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        11,
        7,
        7,
        6,
        7,
        7,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        7,
        8,
        7,
        7,
        8,
        8,
        8,
        8,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        11,
        7,
        9,
        7,
        8,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        7,
        9,
        8,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        11,
        7,
        10,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        8,
        10,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        11,
        11,
        8,
        10,
        9,
        9,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        8,
        11,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        8,
        11,
        10,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        8,
        11,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        8,
        11,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        11,
        11,
        8,
        12,
        10,
        10,
        10,
        10,
        10,
        10,
        11,
        11,
        11,
        11,
        11,
        11,
        11,
        11,
        8,
        8,
        7,
        7,
        7,
        7,
        7,
        7,
        7,
        7,
        7,
        7,
        8,
        8,
        8,
        8,
        4,
        1,
        4,
        4,
        5,
        4,
        6,
        5,
        6,
        4,
        5,
        5,
        6,
        5,
        6,
        6,
        6,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
      ],
      "i8",
      ALLOC_NONE,
      Runtime.GLOBAL_BASE
    );
    var tempDoublePtr = STATICTOP;
    STATICTOP += 16;
    Module["_i64Add"] = _i64Add;
    function _llvm_exp2_f32(x) {
      return Math.pow(2, x);
    }
    function _llvm_exp2_f64() {
      return _llvm_exp2_f32.apply(null, arguments);
    }
    Module["_memset"] = _memset;
    Module["_bitshift64Lshr"] = _bitshift64Lshr;
    function _abort() {
      Module["abort"]();
    }
    function ___lock() {}
    function ___unlock() {}
    var SYSCALLS = {
      varargs: 0,
      get: function(varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
        return ret;
      },
      getStr: function() {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },
      get64: function() {
        var low = SYSCALLS.get(),
          high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },
      getZero: function() {
        assert(SYSCALLS.get() === 0);
      },
    };
    function ___syscall6(which, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD();
        FS.close(stream);
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
          abort(e);
        return -e.errno;
      }
    }
    Module["___muldsi3"] = ___muldsi3;
    Module["___muldi3"] = ___muldi3;
    function ___setErrNo(value) {
      if (Module["___errno_location"])
        HEAP32[Module["___errno_location"]() >> 2] = value;
      return value;
    }
    Module["_sbrk"] = _sbrk;
    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
      return dest;
    }
    Module["_memcpy"] = _memcpy;
    Module["_llvm_bswap_i32"] = _llvm_bswap_i32;
    function ___syscall140(which, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD(),
          offset_high = SYSCALLS.get(),
          offset_low = SYSCALLS.get(),
          result = SYSCALLS.get(),
          whence = SYSCALLS.get();
        var offset = offset_low;
        FS.llseek(stream, offset, whence);
        HEAP32[result >> 2] = stream.position;
        if (stream.getdents && offset === 0 && whence === 0)
          stream.getdents = null;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
          abort(e);
        return -e.errno;
      }
    }
    function ___syscall146(which, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.get(),
          iov = SYSCALLS.get(),
          iovcnt = SYSCALLS.get();
        var ret = 0;
        if (!___syscall146.buffer) {
          ___syscall146.buffers = [null, [], []];
          ___syscall146.printChar = function(stream, curr) {
            var buffer = ___syscall146.buffers[stream];
            assert(buffer);
            if (curr === 0 || curr === 10) {
              (stream === 1 ? Module["print"] : Module["printErr"])(
                UTF8ArrayToString(buffer, 0)
              );
              buffer.length = 0;
            } else {
              buffer.push(curr);
            }
          };
        }
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(iov + i * 8) >> 2];
          var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
          for (var j = 0; j < len; j++) {
            ___syscall146.printChar(stream, HEAPU8[ptr + j]);
          }
          ret += len;
        }
        return ret;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
          abort(e);
        return -e.errno;
      }
    }
    function ___syscall54(which, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
          abort(e);
        return -e.errno;
      }
    }
    __ATEXIT__.push(function() {
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    });
    DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);
    STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
    STACK_MAX = STACK_BASE + TOTAL_STACK;
    DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);
    HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
    staticSealed = true;
    function invoke_ii(index, a1) {
      try {
        return Module["dynCall_ii"](index, a1);
      } catch (e) {
        if (typeof e !== "number" && e !== "longjmp") throw e;
        Module["setThrew"](1, 0);
      }
    }
    function invoke_iiii(index, a1, a2, a3) {
      try {
        return Module["dynCall_iiii"](index, a1, a2, a3);
      } catch (e) {
        if (typeof e !== "number" && e !== "longjmp") throw e;
        Module["setThrew"](1, 0);
      }
    }
    Module.asmGlobalArg = {
      Math: Math,
      Int8Array: Int8Array,
      Int16Array: Int16Array,
      Int32Array: Int32Array,
      Uint8Array: Uint8Array,
      Uint16Array: Uint16Array,
      Uint32Array: Uint32Array,
      Float32Array: Float32Array,
      Float64Array: Float64Array,
      NaN: NaN,
      Infinity: Infinity,
    };
    Module.asmLibraryArg = {
      abort: abort,
      assert: assert,
      enlargeMemory: enlargeMemory,
      getTotalMemory: getTotalMemory,
      abortOnCannotGrowMemory: abortOnCannotGrowMemory,
      invoke_ii: invoke_ii,
      invoke_iiii: invoke_iiii,
      _llvm_exp2_f64: _llvm_exp2_f64,
      ___lock: ___lock,
      _llvm_exp2_f32: _llvm_exp2_f32,
      _abort: _abort,
      ___setErrNo: ___setErrNo,
      ___syscall6: ___syscall6,
      ___syscall140: ___syscall140,
      _emscripten_memcpy_big: _emscripten_memcpy_big,
      ___syscall54: ___syscall54,
      ___unlock: ___unlock,
      ___syscall146: ___syscall146,
      DYNAMICTOP_PTR: DYNAMICTOP_PTR,
      tempDoublePtr: tempDoublePtr,
      ABORT: ABORT,
      STACKTOP: STACKTOP,
      STACK_MAX: STACK_MAX,
    }; // EMSCRIPTEN_START_ASM
    var asm = (function(global, env, buffer) {
      "use asm";
      var a = new global.Int8Array(buffer);
      var b = new global.Int16Array(buffer);
      var c = new global.Int32Array(buffer);
      var d = new global.Uint8Array(buffer);
      var e = new global.Uint16Array(buffer);
      var f = new global.Uint32Array(buffer);
      var g = new global.Float32Array(buffer);
      var h = new global.Float64Array(buffer);
      var i = env.DYNAMICTOP_PTR | 0;
      var j = env.tempDoublePtr | 0;
      var k = env.ABORT | 0;
      var l = env.STACKTOP | 0;
      var m = env.STACK_MAX | 0;
      var n = 0;
      var o = 0;
      var p = 0;
      var q = 0;
      var r = global.NaN,
        s = global.Infinity;
      var t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0.0;
      var y = 0;
      var z = global.Math.floor;
      var A = global.Math.abs;
      var B = global.Math.sqrt;
      var C = global.Math.pow;
      var D = global.Math.cos;
      var E = global.Math.sin;
      var F = global.Math.tan;
      var G = global.Math.acos;
      var H = global.Math.asin;
      var I = global.Math.atan;
      var J = global.Math.atan2;
      var K = global.Math.exp;
      var L = global.Math.log;
      var M = global.Math.ceil;
      var N = global.Math.imul;
      var O = global.Math.min;
      var P = global.Math.max;
      var Q = global.Math.clz32;
      var R = env.abort;
      var S = env.assert;
      var T = env.enlargeMemory;
      var U = env.getTotalMemory;
      var V = env.abortOnCannotGrowMemory;
      var W = env.invoke_ii;
      var X = env.invoke_iiii;
      var Y = env._llvm_exp2_f64;
      var Z = env.___lock;
      var _ = env._llvm_exp2_f32;
      var $ = env._abort;
      var aa = env.___setErrNo;
      var ba = env.___syscall6;
      var ca = env.___syscall140;
      var da = env._emscripten_memcpy_big;
      var ea = env.___syscall54;
      var fa = env.___unlock;
      var ga = env.___syscall146;
      var ha = 0.0;
      // EMSCRIPTEN_START_FUNCS
      function ka(a) {
        a = a | 0;
        var b = 0;
        b = l;
        l = (l + a) | 0;
        l = (l + 15) & -16;
        return b | 0;
      }
      function la() {
        return l | 0;
      }
      function ma(a) {
        a = a | 0;
        l = a;
      }
      function na(a, b) {
        a = a | 0;
        b = b | 0;
        l = a;
        m = b;
      }
      function oa(a, b) {
        a = a | 0;
        b = b | 0;
        if (!n) {
          n = a;
          o = b;
        }
      }
      function pa(a) {
        a = a | 0;
        y = a;
      }
      function qa() {
        return y | 0;
      }
      function ra(a, b) {
        a = a | 0;
        b = b | 0;
        c[a >> 2] = gb(b) | 0;
        c[(a + 4) >> 2] = b;
        c[(a + 8) >> 2] = 0;
        c[(a + 12) >> 2] = 0;
        c[(a + 16) >> 2] = 32;
        return;
      }
      function sa(a) {
        a = a | 0;
        a = c[a >> 2] | 0;
        if (!a) return;
        hb(a);
        return;
      }
      function ta(a, b, d) {
        a = a | 0;
        b = b | 0;
        d = d | 0;
        var e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0;
        k = (a + 16) | 0;
        i = c[k >> 2] | 0;
        if (i >>> 0 > d >>> 0) {
          d = (i - d) | 0;
          c[k >> 2] = d;
          k = (a + 12) | 0;
          c[k >> 2] = c[k >> 2] | (b << d);
          return;
        }
        j = (a + 8) | 0;
        e = c[j >> 2] | 0;
        g = (a + 4) | 0;
        h = c[g >> 2] | 0;
        f = c[a >> 2] | 0;
        if (((e + 4) | 0) >>> 0 < h >>> 0) g = i;
        else {
          f = jb(f, ((((h | 0) / 2) | 0) + h) | 0) | 0;
          c[a >> 2] = f;
          e = c[g >> 2] | 0;
          c[g >> 2] = (((e | 0) / 2) | 0) + e;
          g = c[k >> 2] | 0;
          e = c[j >> 2] | 0;
        }
        i = (d - g) | 0;
        d = (a + 12) | 0;
        c[(f + e) >> 2] = ub((b >>> i) | c[d >> 2] | 0) | 0;
        c[j >> 2] = (c[j >> 2] | 0) + 4;
        j = (32 - i) | 0;
        c[k >> 2] = j;
        c[d >> 2] = (i | 0) == 0 ? 0 : b << j;
        return;
      }
      function ua(a) {
        a = a | 0;
        return ((c[(a + 8) >> 2] << 3) + 32 - (c[(a + 16) >> 2] | 0)) | 0;
      }
      function va(a) {
        a = a | 0;
        var b = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0;
        C = l;
        l = (l + 416) | 0;
        B = C;
        if ((c[a >> 2] | 0) > 0) {
          j = (a + 16) | 0;
          g = 0;
          b = c[j >> 2] | 0;
          do {
            if ((b | 0) > 0) {
              f = 0;
              do {
                b = 0;
                do {
                  if (
                    (c[
                      (a +
                        25264 +
                        ((g * 4608) | 0) +
                        ((f * 2304) | 0) +
                        (b << 2)) >>
                        2
                    ] |
                      0) <
                    0
                      ? ((h =
                          (a +
                            2224 +
                            ((g * 4608) | 0) +
                            ((f * 2304) | 0) +
                            (b << 2)) |
                          0),
                        (i = c[h >> 2] | 0),
                        (i | 0) > 0)
                      : 0
                  )
                    c[h >> 2] = 0 - i;
                  b = (b + 1) | 0;
                } while ((b | 0) != 576);
                f = (f + 1) | 0;
                b = c[j >> 2] | 0;
              } while ((f | 0) < (b | 0));
            }
            g = (g + 1) | 0;
          } while ((g | 0) < (c[a >> 2] | 0));
        }
        j = (a + 116) | 0;
        tb(B | 0, j | 0, 408) | 0;
        z = (a + 96) | 0;
        ta(z, 2047, 11);
        i = (a + 8) | 0;
        ta(z, c[i >> 2] | 0, 2);
        ta(z, c[(a + 12) >> 2] | 0, 2);
        ta(z, ((c[(a + 76) >> 2] | 0) == 0) & 1, 1);
        ta(z, c[(a + 68) >> 2] | 0, 4);
        A = (a + 72) | 0;
        ta(z, (c[A >> 2] | 0) % 3 | 0, 2);
        ta(z, c[(a + 32) >> 2] | 0, 1);
        ta(z, c[(a + 80) >> 2] | 0, 1);
        ta(z, c[(a + 20) >> 2] | 0, 2);
        ta(z, c[(a + 84) >> 2] | 0, 2);
        ta(z, c[(a + 88) >> 2] | 0, 1);
        ta(z, c[(a + 92) >> 2] | 0, 1);
        ta(z, c[(a + 28) >> 2] | 0, 2);
        do
          if ((c[i >> 2] | 0) == 3) {
            ta(z, 0, 9);
            b = c[B >> 2] | 0;
            if ((c[a >> 2] | 0) == 2) {
              ta(z, b, 3);
              break;
            } else {
              ta(z, b, 5);
              break;
            }
          } else {
            ta(z, 0, 8);
            b = c[B >> 2] | 0;
            if ((c[a >> 2] | 0) == 2) {
              ta(z, b, 2);
              break;
            } else {
              ta(z, b, 1);
              break;
            }
          }
        while (0);
        if ((c[i >> 2] | 0) == 3 ? (c[a >> 2] | 0) > 0 : 0) {
          b = 0;
          do {
            ta(z, c[(B + 8 + (b << 4)) >> 2] | 0, 1);
            ta(z, c[(B + 8 + (b << 4) + 4) >> 2] | 0, 1);
            ta(z, c[(B + 8 + (b << 4) + 8) >> 2] | 0, 1);
            ta(z, c[(B + 8 + (b << 4) + 12) >> 2] | 0, 1);
            b = (b + 1) | 0;
          } while ((b | 0) < (c[a >> 2] | 0));
        }
        y = (a + 16) | 0;
        b = c[y >> 2] | 0;
        if ((b | 0) > 0) {
          h = 0;
          g = c[a >> 2] | 0;
          do {
            if ((g | 0) > 0) {
              f = 0;
              do {
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0)) >> 2] | 0,
                  12
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 4) >> 2] | 0,
                  9
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 12) >> 2] | 0,
                  8
                );
                b =
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 16) >> 2] | 0;
                if ((c[i >> 2] | 0) == 3) ta(z, b, 4);
                else ta(z, b, 9);
                ta(z, 0, 1);
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 20) >> 2] | 0,
                  5
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 24) >> 2] | 0,
                  5
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 28) >> 2] | 0,
                  5
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 32) >> 2] | 0,
                  4
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 36) >> 2] | 0,
                  3
                );
                if ((c[i >> 2] | 0) == 3)
                  ta(
                    z,
                    c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 40) >> 2] |
                      0,
                    1
                  );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 44) >> 2] | 0,
                  1
                );
                ta(
                  z,
                  c[(B + 40 + ((h * 184) | 0) + ((f * 92) | 0) + 48) >> 2] | 0,
                  1
                );
                f = (f + 1) | 0;
                g = c[a >> 2] | 0;
              } while ((f | 0) < (g | 0));
              b = c[y >> 2] | 0;
            }
            h = (h + 1) | 0;
          } while ((h | 0) < (b | 0));
        }
        tb(B | 0, j | 0, 408) | 0;
        if ((b | 0) <= 0) {
          l = C;
          return;
        }
        x = 0;
        f = c[a >> 2] | 0;
        do {
          if ((f | 0) > 0) {
            w = (x | 0) == 0;
            v = 0;
            do {
              f = c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 16) >> 2] | 0;
              b = c[(1044 + (f << 2)) >> 2] | 0;
              f = c[(1108 + (f << 2)) >> 2] | 0;
              if (!w ? (c[(B + 8 + (v << 4)) >> 2] | 0) != 0 : 0) t = 39;
              else {
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0)) >> 2] | 0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 4) >> 2] | 0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 8) >> 2] | 0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 12) >> 2] |
                    0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 16) >> 2] |
                    0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 20) >> 2] |
                    0,
                  b
                );
                if (w) t = 40;
                else t = 39;
              }
              if ((t | 0) == 39)
                if (!(c[(B + 8 + (v << 4) + 4) >> 2] | 0)) t = 40;
                else t = 41;
              if ((t | 0) == 40) {
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 24) >> 2] |
                    0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 28) >> 2] |
                    0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 32) >> 2] |
                    0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 36) >> 2] |
                    0,
                  b
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 40) >> 2] |
                    0,
                  b
                );
                if (w) t = 42;
                else t = 41;
              }
              if ((t | 0) == 41)
                if (!(c[(B + 8 + (v << 4) + 8) >> 2] | 0)) t = 42;
                else t = 43;
              if ((t | 0) == 42) {
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 44) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 48) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 52) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 56) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 60) >> 2] |
                    0,
                  f
                );
                if (w) t = 44;
                else t = 43;
              }
              if (
                (t | 0) == 43
                  ? ((t = 0), (c[(B + 8 + (v << 4) + 12) >> 2] | 0) == 0)
                  : 0
              )
                t = 44;
              if ((t | 0) == 44) {
                t = 0;
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 64) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 68) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 72) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 76) >> 2] |
                    0,
                  f
                );
                ta(
                  z,
                  c[(a + 1208 + ((x * 176) | 0) + ((v * 88) | 0) + 80) >> 2] |
                    0,
                  f
                );
              }
              q = c[A >> 2] | 0;
              u = ua(z) | 0;
              b = c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 4) >> 2] << 1;
              s = c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 32) >> 2] | 0;
              r = c[(1464 + ((q * 92) | 0) + ((s + 1) << 2)) >> 2] | 0;
              s =
                c[
                  (1464 +
                    ((q * 92) | 0) +
                    ((s +
                      2 +
                      (c[
                        (B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 36) >> 2
                      ] |
                        0)) <<
                      2)) >>
                    2
                ] | 0;
              if ((b | 0) > 0) {
                q = 0;
                do {
                  g =
                    c[
                      (B +
                        40 +
                        ((x * 184) | 0) +
                        ((v * 92) | 0) +
                        20 +
                        (((((q | 0) >= (r | 0)) & 1) +
                          (((q | 0) >= (s | 0)) & 1)) <<
                          2)) >>
                        2
                    ] | 0;
                  do
                    if (g | 0) {
                      h =
                        c[
                          (a +
                            2224 +
                            ((v * 4608) | 0) +
                            ((x * 2304) | 0) +
                            (q << 2)) >>
                            2
                        ] | 0;
                      k =
                        c[
                          (a +
                            2224 +
                            ((v * 4608) | 0) +
                            ((x * 2304) | 0) +
                            ((q | 1) << 2)) >>
                            2
                        ] | 0;
                      i = (h | 0) > 0;
                      h = i ? h : (0 - h) | 0;
                      i = (i ^ 1) & 1;
                      o = (k | 0) > 0;
                      k = o ? k : (0 - k) | 0;
                      o = (o ^ 1) & 1;
                      f = c[(8 + ((g * 24) | 0) + 4) >> 2] | 0;
                      if ((g | 0) <= 15) {
                        p = ((N(f, h) | 0) + k) | 0;
                        j =
                          e[
                            ((c[(8 + ((g * 24) | 0) + 16) >> 2] | 0) +
                              (p << 1)) >>
                              1
                          ] | 0;
                        n = (h | 0) == 0;
                        j = n ? j : (j << 1) | i;
                        m = (k | 0) == 0;
                        ta(
                          z,
                          m ? j : (j << 1) | o,
                          (((m ^ 1) & 1) +
                            ((n ^ 1) & 1) +
                            (d[
                              ((c[(8 + ((g * 24) | 0) + 20) >> 2] | 0) + p) >> 0
                            ] |
                              0)) |
                            0
                        );
                        break;
                      }
                      m = c[(8 + ((g * 24) | 0) + 8) >> 2] | 0;
                      E = (h | 0) > 14;
                      F = E ? 15 : h;
                      D = (k | 0) > 14;
                      j = D ? 15 : k;
                      n = ((N(F, f) | 0) + j) | 0;
                      p =
                        e[
                          ((c[(8 + ((g * 24) | 0) + 16) >> 2] | 0) +
                            (n << 1)) >>
                            1
                        ] | 0;
                      n =
                        d[((c[(8 + ((g * 24) | 0) + 20) >> 2] | 0) + n) >> 0] |
                        0;
                      f = E ? (h + -15) | 0 : 0;
                      g = (F | 0) == 0;
                      f = g ? f : (f << 1) | i;
                      g = ((E ? m : 0) + ((g ^ 1) & 1)) | 0;
                      if (!D) {
                        if (j) t = 51;
                      } else {
                        g = (g + m) | 0;
                        f = (f << m) | (k + 2147483633);
                        t = 51;
                      }
                      if ((t | 0) == 51) {
                        t = 0;
                        g = (g + 1) | 0;
                        f = (f << 1) | o;
                      }
                      ta(z, p, n);
                      ta(z, f, g);
                    }
                  while (0);
                  q = (q + 2) | 0;
                } while ((q | 0) < (b | 0));
              }
              f =
                ((c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 48) >> 2] |
                  0) +
                  32) |
                0;
              h =
                ((c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 8) >> 2] <<
                  2) +
                  b) |
                0;
              if ((b | 0) < (h | 0)) {
                g = c[(8 + ((f * 24) | 0) + 16) >> 2] | 0;
                f = c[(8 + ((f * 24) | 0) + 20) >> 2] | 0;
                do {
                  E =
                    c[
                      (a +
                        2224 +
                        ((v * 4608) | 0) +
                        ((x * 2304) | 0) +
                        (b << 2)) >>
                        2
                    ] | 0;
                  D =
                    c[
                      (a +
                        2224 +
                        ((v * 4608) | 0) +
                        ((x * 2304) | 0) +
                        ((b | 1) << 2)) >>
                        2
                    ] | 0;
                  t =
                    c[
                      (a +
                        2224 +
                        ((v * 4608) | 0) +
                        ((x * 2304) | 0) +
                        ((b + 2) << 2)) >>
                        2
                    ] | 0;
                  F =
                    c[
                      (a +
                        2224 +
                        ((v * 4608) | 0) +
                        ((x * 2304) | 0) +
                        ((b + 3) << 2)) >>
                        2
                    ] | 0;
                  p = (E | 0) > 0;
                  E = p ? E : (0 - E) | 0;
                  q = (D | 0) > 0;
                  D = q ? D : (0 - D) | 0;
                  r = (t | 0) > 0;
                  t = r ? t : (0 - t) | 0;
                  s = (F | 0) > 0;
                  F = s ? F : (0 - F) | 0;
                  o = ((D << 1) + E + (t << 2) + (F << 3)) | 0;
                  ta(z, e[(g + (o << 1)) >> 1] | 0, d[(f + o) >> 0] | 0);
                  E = (E | 0) == 0;
                  p = ((p | E) ^ 1) & 1;
                  D = (D | 0) == 0;
                  q = D ? p : (p << 1) | ((q ^ 1) & 1);
                  t = (t | 0) == 0;
                  r = t ? q : (q << 1) | ((r ^ 1) & 1);
                  F = (F | 0) == 0;
                  ta(
                    z,
                    F ? r : (r << 1) | ((s ^ 1) & 1),
                    (((t ^ 1) & 1) +
                      (D ? (E ^ 1) & 1 : E ? 1 : 2) +
                      ((F ^ 1) & 1)) |
                      0
                  );
                  b = (b + 4) | 0;
                } while ((b | 0) < (h | 0));
              }
              b = ua(z) | 0;
              b =
                ((c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0)) >> 2] | 0) -
                  (c[(B + 40 + ((x * 184) | 0) + ((v * 92) | 0) + 52) >> 2] |
                    0) +
                  (u - b)) |
                0;
              if (b | 0) {
                f = (b | 0) % 32 | 0;
                if (((b + 31) | 0) >>> 0 >= 63) {
                  b = ((b | 0) / 32) | 0;
                  do {
                    b = (b + -1) | 0;
                    ta(z, -1, 32);
                  } while ((b | 0) != 0);
                }
                if (f | 0) ta(z, ((1 << f) + -1) | 0, f);
              }
              v = (v + 1) | 0;
              f = c[a >> 2] | 0;
            } while ((v | 0) < (f | 0));
            b = c[y >> 2] | 0;
          }
          x = (x + 1) | 0;
        } while ((x | 0) < (b | 0));
        l = C;
        return;
      }
      function wa(a, b, e, f, g, i) {
        a = a | 0;
        b = b | 0;
        e = e | 0;
        f = f | 0;
        g = g | 0;
        i = i | 0;
        var j = 0,
          k = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          z = 0,
          A = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0.0,
          L = 0,
          M = 0,
          O = 0,
          P = 0;
        J = (e + 72) | 0;
        if ((b | 0) < 0) c[J >> 2] = (c[J >> 2] | 0) + -1;
        v = (i + 39100) | 0;
        w = (i + 34488) | 0;
        x = (e + 8) | 0;
        z = (e + 4) | 0;
        A = (e + 48) | 0;
        C = (e + 32) | 0;
        D = (e + 36) | 0;
        E = (e + 20) | 0;
        F = (e + 24) | 0;
        G = (e + 28) | 0;
        H = (e + 60) | 0;
        I = (e + 64) | 0;
        r = (e + 68) | 0;
        s = (i + 72) | 0;
        t = c[199] | 0;
        u = c[205] | 0;
        do {
          while (1) {
            f = c[J >> 2] | 0;
            c[J >> 2] = f + 1;
            f = (f + 128) | 0;
            l = c[(i + 40480 + (f << 2)) >> 2] | 0;
            q = c[v >> 2] | 0;
            m = (((l | 0) < 0) << 31) >> 31;
            q = rb(q | 0, ((((q | 0) < 0) << 31) >> 31) | 0, l | 0, m | 0) | 0;
            nb(q | 0, y | 0, -2147483648, 0) | 0;
            if ((y | 0) > 165140) continue;
            k = (i + 39456 + (f << 3)) | 0;
            j = c[w >> 2] | 0;
            g = 0;
            e = 0;
            do {
              f = c[(j + (e << 2)) >> 2] | 0;
              f = (f | 0) > -1 ? f : (0 - f) | 0;
              f =
                rb(f | 0, ((((f | 0) < 0) << 31) >> 31) | 0, l | 0, m | 0) | 0;
              nb(f | 0, y | 0, -2147483648, 0) | 0;
              f = y;
              if ((f | 0) < 1e4) f = c[(i + 40992 + (f << 2)) >> 2] | 0;
              else {
                K =
                  +h[k >> 3] *
                  +(c[(i + 36796 + (e << 2)) >> 2] | 0) *
                  4.656612875e-10;
                f = ~~+B(+(+B(+K) * K));
              }
              c[(a + (e << 2)) >> 2] = f;
              g = (g | 0) < (f | 0) ? f : g;
              e = (e + 1) | 0;
            } while ((e | 0) != 576);
            if ((g | 0) <= 8192) {
              g = 576;
              break;
            }
          }
          while (1) {
            if ((g | 0) <= 1) {
              n = 13;
              break;
            }
            if (c[(a + ((g + -1) << 2)) >> 2] | 0) {
              n = 16;
              break;
            }
            f = (g + -2) | 0;
            if (!(c[(a + (f << 2)) >> 2] | 0)) g = f;
            else {
              n = 16;
              break;
            }
          }
          do
            if ((n | 0) == 13) {
              c[x >> 2] = 0;
              n = 23;
            } else if ((n | 0) == 16) {
              c[x >> 2] = 0;
              if ((g | 0) > 3) {
                j = 0;
                while (1) {
                  if ((c[(a + ((g + -1) << 2)) >> 2] | 0) >= 2) {
                    n = 24;
                    break;
                  }
                  if ((c[(a + ((g + -2) << 2)) >> 2] | 0) >= 2) {
                    n = 24;
                    break;
                  }
                  if ((c[(a + ((g + -3) << 2)) >> 2] | 0) >= 2) {
                    n = 24;
                    break;
                  }
                  f = (g + -4) | 0;
                  e = (j + 1) | 0;
                  if ((c[(a + (f << 2)) >> 2] | 0) >= 2) {
                    n = 24;
                    break;
                  }
                  c[x >> 2] = e;
                  if ((f | 0) > 3) {
                    g = f;
                    j = e;
                  } else {
                    n = 18;
                    break;
                  }
                }
                if ((n | 0) == 18) {
                  n = 0;
                  q = f >> 1;
                  c[z >> 2] = q;
                  g = f;
                  f = q;
                } else if ((n | 0) == 24) {
                  n = 0;
                  f = g >>> 1;
                  c[z >> 2] = f;
                  if (!j) {
                    k = 0;
                    j = 0;
                    break;
                  } else e = j;
                }
                j = 0;
                l = g;
                m = 0;
                k = 0;
                while (1) {
                  o = c[(a + (l << 2)) >> 2] | 0;
                  L = c[(a + ((l | 1) << 2)) >> 2] | 0;
                  M = c[(a + ((l + 2) << 2)) >> 2] | 0;
                  p = c[(a + ((l + 3) << 2)) >> 2] | 0;
                  q = ((L << 1) + o + (M << 2) + (p << 3)) | 0;
                  o = (o | 0) != 0;
                  p =
                    ((((M | 0) != 0) & 1) +
                      ((L | 0) == 0 ? o & 1 : o ? 2 : 1) +
                      (((p | 0) != 0) & 1)) |
                    0;
                  j = ((d[(t + q) >> 0] | 0) + j + p) | 0;
                  k = (p + k + (d[(u + q) >> 0] | 0)) | 0;
                  m = (m + 1) | 0;
                  if ((m | 0) == (e | 0)) break;
                  else l = (l + 4) | 0;
                }
              } else n = 23;
            }
          while (0);
          if ((n | 0) == 23) {
            f = g >> 1;
            c[z >> 2] = f;
            k = 0;
            j = 0;
          }
          M = (j | 0) < (k | 0);
          q = M ? j : k;
          c[A >> 2] = (M ^ 1) & 1;
          if (!f) {
            c[C >> 2] = 0;
            c[D >> 2] = 0;
            j = c[H >> 2] | 0;
          } else {
            j = c[s >> 2] | 0;
            e = 0;
            while (1)
              if ((c[(1464 + ((j * 92) | 0) + (e << 2)) >> 2] | 0) < (g | 0))
                e = (e + 1) | 0;
              else break;
            f = c[(824 + (e << 3)) >> 2] | 0;
            while (1) {
              k = (1464 + ((j * 92) | 0) + ((f + 1) << 2)) | 0;
              l = c[k >> 2] | 0;
              if (((f | 0) != 0) & ((l | 0) > (g | 0))) f = (f + -1) | 0;
              else break;
            }
            c[C >> 2] = f;
            c[H >> 2] = l;
            f = c[(824 + (e << 3) + 4) >> 2] | 0;
            while (1) {
              e = c[(k + ((f + 1) << 2)) >> 2] | 0;
              if (((f | 0) != 0) & ((e | 0) > (g | 0))) f = (f + -1) | 0;
              else break;
            }
            c[D >> 2] = f;
            c[I >> 2] = e;
            c[r >> 2] = g;
            j = l;
          }
          c[E >> 2] = 0;
          c[F >> 2] = 0;
          c[G >> 2] = 0;
          if (!j) k = 0;
          else {
            k = xa(a, 0, j) | 0;
            c[E >> 2] = k;
          }
          e = c[I >> 2] | 0;
          n = e >>> 0 > j >>> 0;
          if (n) {
            o = xa(a, j, e) | 0;
            c[F >> 2] = o;
          } else o = 0;
          if (g >>> 0 > e >>> 0) {
            p = xa(a, e, g) | 0;
            c[G >> 2] = p;
          } else p = 0;
          do
            if (k) {
              m = c[(8 + ((k * 24) | 0) + 4) >> 2] | 0;
              l = c[(8 + ((k * 24) | 0) + 8) >> 2] | 0;
              f = (j | 0) != 0;
              if (k >>> 0 > 15) {
                if (!f) {
                  f = 0;
                  break;
                }
                k = c[(8 + ((k * 24) | 0) + 20) >> 2] | 0;
                f = 0;
                g = 0;
                do {
                  L = c[(a + (g << 2)) >> 2] | 0;
                  M = c[(a + ((g | 1) << 2)) >> 2] | 0;
                  P = (L | 0) > 14;
                  L = P ? 15 : L;
                  O = (M | 0) > 14;
                  M = O ? 15 : M;
                  f =
                    ((P ? l : 0) +
                      f +
                      (O ? l : 0) +
                      (d[(k + ((N(L, m) | 0) + M)) >> 0] | 0) +
                      (((L | 0) != 0) & 1) +
                      (((M | 0) != 0) & 1)) |
                    0;
                  g = (g + 2) | 0;
                } while (g >>> 0 < j >>> 0);
              } else {
                if (!f) {
                  f = 0;
                  break;
                }
                k = c[(8 + ((k * 24) | 0) + 20) >> 2] | 0;
                g = 0;
                f = 0;
                do {
                  O = c[(a + (g << 2)) >> 2] | 0;
                  P = c[(a + ((g | 1) << 2)) >> 2] | 0;
                  f =
                    ((((O | 0) != 0) & 1) +
                      f +
                      (((P | 0) != 0) & 1) +
                      (d[(k + ((N(O, m) | 0) + P)) >> 0] | 0)) |
                    0;
                  g = (g + 2) | 0;
                } while (g >>> 0 < j >>> 0);
              }
            } else f = 0;
          while (0);
          if (o) {
            m = c[(8 + ((o * 24) | 0) + 4) >> 2] | 0;
            l = c[(8 + ((o * 24) | 0) + 8) >> 2] | 0;
            if (o >>> 0 > 15)
              if (n) {
                k = c[(8 + ((o * 24) | 0) + 20) >> 2] | 0;
                g = 0;
                do {
                  O = c[(a + (j << 2)) >> 2] | 0;
                  P = c[(a + ((j + 1) << 2)) >> 2] | 0;
                  L = (O | 0) > 14;
                  O = L ? 15 : O;
                  M = (P | 0) > 14;
                  P = M ? 15 : P;
                  g =
                    ((L ? l : 0) +
                      g +
                      (M ? l : 0) +
                      (d[(k + ((N(O, m) | 0) + P)) >> 0] | 0) +
                      (((O | 0) != 0) & 1) +
                      (((P | 0) != 0) & 1)) |
                    0;
                  j = (j + 2) | 0;
                } while (j >>> 0 < e >>> 0);
              } else g = 0;
            else if (n) {
              k = c[(8 + ((o * 24) | 0) + 20) >> 2] | 0;
              g = 0;
              do {
                O = c[(a + (j << 2)) >> 2] | 0;
                P = c[(a + ((j + 1) << 2)) >> 2] | 0;
                g =
                  ((((O | 0) != 0) & 1) +
                    g +
                    (((P | 0) != 0) & 1) +
                    (d[(k + ((N(O, m) | 0) + P)) >> 0] | 0)) |
                  0;
                j = (j + 2) | 0;
              } while (j >>> 0 < e >>> 0);
            } else g = 0;
            f = (g + f) | 0;
          }
          if (p) {
            l = c[r >> 2] | 0;
            m = c[(8 + ((p * 24) | 0) + 4) >> 2] | 0;
            k = c[(8 + ((p * 24) | 0) + 8) >> 2] | 0;
            g = e >>> 0 < l >>> 0;
            if (p >>> 0 > 15)
              if (g) {
                j = c[(8 + ((p * 24) | 0) + 20) >> 2] | 0;
                g = 0;
                do {
                  O = c[(a + (e << 2)) >> 2] | 0;
                  P = c[(a + ((e + 1) << 2)) >> 2] | 0;
                  L = (O | 0) > 14;
                  O = L ? 15 : O;
                  M = (P | 0) > 14;
                  P = M ? 15 : P;
                  g =
                    ((L ? k : 0) +
                      g +
                      (M ? k : 0) +
                      (d[(j + ((N(O, m) | 0) + P)) >> 0] | 0) +
                      (((O | 0) != 0) & 1) +
                      (((P | 0) != 0) & 1)) |
                    0;
                  e = (e + 2) | 0;
                } while (e >>> 0 < l >>> 0);
              } else g = 0;
            else if (g) {
              j = c[(8 + ((p * 24) | 0) + 20) >> 2] | 0;
              g = 0;
              do {
                O = c[(a + (e << 2)) >> 2] | 0;
                P = c[(a + ((e + 1) << 2)) >> 2] | 0;
                g =
                  ((((O | 0) != 0) & 1) +
                    g +
                    (((P | 0) != 0) & 1) +
                    (d[(j + ((N(O, m) | 0) + P)) >> 0] | 0)) |
                  0;
                e = (e + 2) | 0;
              } while (e >>> 0 < l >>> 0);
            } else g = 0;
            f = (g + f) | 0;
          }
          f = (f + q) | 0;
        } while ((f | 0) > (b | 0));
        return f | 0;
      }
      function xa(a, b, e) {
        a = a | 0;
        b = b | 0;
        e = e | 0;
        var f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0;
        if (b >>> 0 < e >>> 0) {
          f = b;
          g = 0;
        } else {
          e = 0;
          return e | 0;
        }
        do {
          m = c[(a + (f << 2)) >> 2] | 0;
          g = (g | 0) < (m | 0) ? m : g;
          f = (f + 1) | 0;
        } while ((f | 0) != (e | 0));
        if (!g) {
          e = 0;
          return e | 0;
        }
        if ((g | 0) >= 15) {
          f = (g + -15) | 0;
          if ((c[95] | 0) >>> 0 < f >>> 0)
            if ((c[101] | 0) >>> 0 < f >>> 0)
              if ((c[107] | 0) >>> 0 < f >>> 0)
                if ((c[113] | 0) >>> 0 < f >>> 0)
                  if ((c[119] | 0) >>> 0 < f >>> 0)
                    if ((c[125] | 0) >>> 0 < f >>> 0)
                      if ((c[131] | 0) >>> 0 < f >>> 0)
                        if ((c[137] | 0) >>> 0 < f >>> 0)
                          m = (c[143] | 0) >>> 0 < f >>> 0 ? 0 : 23;
                        else m = 22;
                      else m = 21;
                    else m = 20;
                  else m = 19;
                else m = 18;
              else m = 17;
            else m = 16;
          else m = 15;
          if ((c[149] | 0) >>> 0 < f >>> 0)
            if ((c[155] | 0) >>> 0 < f >>> 0)
              if ((c[161] | 0) >>> 0 < f >>> 0)
                if ((c[167] | 0) >>> 0 < f >>> 0)
                  if ((c[173] | 0) >>> 0 < f >>> 0)
                    if ((c[179] | 0) >>> 0 < f >>> 0)
                      if ((c[185] | 0) >>> 0 < f >>> 0)
                        l = (c[191] | 0) >>> 0 < f >>> 0 ? 0 : 31;
                      else l = 30;
                    else l = 29;
                  else l = 28;
                else l = 27;
              else l = 26;
            else l = 25;
          else l = 24;
          if (m) {
            i = c[(8 + ((m * 24) | 0) + 4) >> 2] | 0;
            h = c[(8 + ((m * 24) | 0) + 8) >> 2] | 0;
            j = c[(8 + ((m * 24) | 0) + 20) >> 2] | 0;
            if (m >>> 0 > 15) {
              f = 0;
              g = b;
              do {
                n = c[(a + (g << 2)) >> 2] | 0;
                k = c[(a + ((g + 1) << 2)) >> 2] | 0;
                p = (n | 0) > 14;
                n = p ? 15 : n;
                o = (k | 0) > 14;
                k = o ? 15 : k;
                f =
                  ((p ? h : 0) +
                    f +
                    (o ? h : 0) +
                    (d[(j + ((N(n, i) | 0) + k)) >> 0] | 0) +
                    (((n | 0) != 0) & 1) +
                    (((k | 0) != 0) & 1)) |
                  0;
                g = (g + 2) | 0;
              } while (g >>> 0 < e >>> 0);
              k = f;
            } else {
              g = b;
              f = 0;
              do {
                o = c[(a + (g << 2)) >> 2] | 0;
                p = c[(a + ((g + 1) << 2)) >> 2] | 0;
                f =
                  ((((o | 0) != 0) & 1) +
                    f +
                    (((p | 0) != 0) & 1) +
                    (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0)) |
                  0;
                g = (g + 2) | 0;
              } while (g >>> 0 < e >>> 0);
              k = f;
            }
          } else k = 0;
          if (!l) {
            p = 0;
            p = (p | 0) < (k | 0);
            p = p ? l : m;
            return p | 0;
          }
          i = c[(8 + ((l * 24) | 0) + 4) >> 2] | 0;
          h = c[(8 + ((l * 24) | 0) + 8) >> 2] | 0;
          j = c[(8 + ((l * 24) | 0) + 20) >> 2] | 0;
          if (l >>> 0 > 15) {
            f = 0;
            g = b;
            do {
              o = c[(a + (g << 2)) >> 2] | 0;
              p = c[(a + ((g + 1) << 2)) >> 2] | 0;
              b = (o | 0) > 14;
              o = b ? 15 : o;
              n = (p | 0) > 14;
              p = n ? 15 : p;
              f =
                ((b ? h : 0) +
                  f +
                  (n ? h : 0) +
                  (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0) +
                  (((o | 0) != 0) & 1) +
                  (((p | 0) != 0) & 1)) |
                0;
              g = (g + 2) | 0;
            } while (g >>> 0 < e >>> 0);
            p = (f | 0) < (k | 0);
            p = p ? l : m;
            return p | 0;
          } else {
            g = b;
            f = 0;
            do {
              o = c[(a + (g << 2)) >> 2] | 0;
              p = c[(a + ((g + 1) << 2)) >> 2] | 0;
              f =
                ((((o | 0) != 0) & 1) +
                  f +
                  (((p | 0) != 0) & 1) +
                  (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0)) |
                0;
              g = (g + 2) | 0;
            } while (g >>> 0 < e >>> 0);
            p = (f | 0) < (k | 0);
            p = p ? l : m;
            return p | 0;
          }
        } else k = 14;
        while (1) {
          l = (k + -1) | 0;
          if (!k) {
            f = 0;
            h = 44;
            break;
          }
          if ((c[(8 + ((l * 24) | 0)) >> 2] | 0) >>> 0 > g >>> 0) break;
          else k = l;
        }
        if ((h | 0) == 44) return f | 0;
        if (!l) {
          p = 0;
          return p | 0;
        }
        i = c[(8 + ((l * 24) | 0) + 4) >> 2] | 0;
        h = c[(8 + ((l * 24) | 0) + 8) >> 2] | 0;
        j = c[(8 + ((l * 24) | 0) + 20) >> 2] | 0;
        if (l >>> 0 > 15) {
          f = 0;
          g = b;
          do {
            o = c[(a + (g << 2)) >> 2] | 0;
            p = c[(a + ((g + 1) << 2)) >> 2] | 0;
            m = (o | 0) > 14;
            o = m ? 15 : o;
            n = (p | 0) > 14;
            p = n ? 15 : p;
            f =
              ((m ? h : 0) +
                f +
                (n ? h : 0) +
                (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0) +
                (((o | 0) != 0) & 1) +
                (((p | 0) != 0) & 1)) |
              0;
            g = (g + 2) | 0;
          } while (g >>> 0 < e >>> 0);
          j = f;
        } else {
          g = b;
          f = 0;
          do {
            o = c[(a + (g << 2)) >> 2] | 0;
            p = c[(a + ((g + 1) << 2)) >> 2] | 0;
            f =
              ((((o | 0) != 0) & 1) +
                f +
                (((p | 0) != 0) & 1) +
                (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0)) |
              0;
            g = (g + 2) | 0;
          } while (g >>> 0 < e >>> 0);
          j = f;
        }
        switch (k | 0) {
          case 3: {
            h = c[21] | 0;
            i = c[25] | 0;
            f = b;
            g = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              g =
                ((((o | 0) != 0) & 1) +
                  g +
                  (((p | 0) != 0) & 1) +
                  (d[(i + ((N(o, h) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            p = (g | 0) > (j | 0) ? l : 3;
            return p | 0;
          }
          case 6: {
            h = c[39] | 0;
            i = c[43] | 0;
            f = b;
            g = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              g =
                ((((o | 0) != 0) & 1) +
                  g +
                  (((p | 0) != 0) & 1) +
                  (d[(i + ((N(o, h) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            p = (g | 0) > (j | 0) ? l : 6;
            return p | 0;
          }
          case 8: {
            g = c[51] | 0;
            h = c[55] | 0;
            f = b;
            i = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              i =
                ((((o | 0) != 0) & 1) +
                  i +
                  (((p | 0) != 0) & 1) +
                  (d[(h + ((N(o, g) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            h = (i | 0) > (j | 0);
            k = h ? l : 8;
            h = h ? j : i;
            i = c[57] | 0;
            j = c[61] | 0;
            f = b;
            g = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              g =
                ((((o | 0) != 0) & 1) +
                  g +
                  (((p | 0) != 0) & 1) +
                  (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            return ((g | 0) > (h | 0) ? k : 9) | 0;
          }
          case 11: {
            g = c[69] | 0;
            h = c[73] | 0;
            f = b;
            i = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              i =
                ((((o | 0) != 0) & 1) +
                  i +
                  (((p | 0) != 0) & 1) +
                  (d[(h + ((N(o, g) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            h = (i | 0) > (j | 0);
            k = h ? l : 11;
            h = h ? j : i;
            i = c[75] | 0;
            j = c[79] | 0;
            f = b;
            g = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              g =
                ((((o | 0) != 0) & 1) +
                  g +
                  (((p | 0) != 0) & 1) +
                  (d[(j + ((N(o, i) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            p = (g | 0) > (h | 0) ? k : 12;
            return p | 0;
          }
          case 14: {
            h = c[93] | 0;
            i = c[97] | 0;
            f = b;
            g = 0;
            do {
              o = c[(a + (f << 2)) >> 2] | 0;
              p = c[(a + ((f + 1) << 2)) >> 2] | 0;
              g =
                ((((o | 0) != 0) & 1) +
                  g +
                  (((p | 0) != 0) & 1) +
                  (d[(i + ((N(o, h) | 0) + p)) >> 0] | 0)) |
                0;
              f = (f + 2) | 0;
            } while (f >>> 0 < e >>> 0);
            p = (g | 0) > (j | 0) ? l : 15;
            return p | 0;
          }
          default: {
            p = l;
            return p | 0;
          }
        }
        return 0;
      }
      function ya(a, b, e, f, g, i) {
        a = a | 0;
        b = b | 0;
        e = e | 0;
        f = f | 0;
        g = g | 0;
        i = i | 0;
        var j = 0,
          k = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          z = 0,
          A = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0,
          L = 0,
          M = 0,
          O = 0,
          P = 0,
          Q = 0.0,
          R = 0,
          S = 0,
          T = 0,
          U = 0;
        K = (i + 39100) | 0;
        L = (i + 34488) | 0;
        M = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 8) | 0;
        O = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 4) | 0;
        u = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 48) | 0;
        v = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 32) | 0;
        w = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 36) | 0;
        x = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 20) | 0;
        z = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 24) | 0;
        A = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 28) | 0;
        C = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 60) | 0;
        D = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 64) | 0;
        E = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 68) | 0;
        F = (i + 72) | 0;
        G = c[199] | 0;
        H = c[205] | 0;
        t = 120;
        P = -120;
        do {
          I = ((t | 0) / 2) | 0;
          J = (I + P) | 0;
          b = (J + 127) | 0;
          n = c[(i + 40480 + (b << 2)) >> 2] | 0;
          s = c[K >> 2] | 0;
          o = (((n | 0) < 0) << 31) >> 31;
          s = rb(s | 0, ((((s | 0) < 0) << 31) >> 31) | 0, n | 0, o | 0) | 0;
          nb(s | 0, y | 0, -2147483648, 0) | 0;
          if ((y | 0) <= 165140) {
            m = (i + 39456 + (b << 3)) | 0;
            l = c[L >> 2] | 0;
            j = 0;
            k = 0;
            do {
              b = c[(l + (k << 2)) >> 2] | 0;
              b = (b | 0) > -1 ? b : (0 - b) | 0;
              b =
                rb(b | 0, ((((b | 0) < 0) << 31) >> 31) | 0, n | 0, o | 0) | 0;
              nb(b | 0, y | 0, -2147483648, 0) | 0;
              b = y;
              if ((b | 0) < 1e4) b = c[(i + 40992 + (b << 2)) >> 2] | 0;
              else {
                Q =
                  +h[m >> 3] *
                  +(c[(i + 36796 + (k << 2)) >> 2] | 0) *
                  4.656612875e-10;
                b = ~~+B(+(+B(+Q) * Q));
              }
              c[(e + (k << 2)) >> 2] = b;
              j = (j | 0) < (b | 0) ? b : j;
              k = (k + 1) | 0;
            } while ((k | 0) != 576);
            if ((j | 0) <= 8192) {
              j = 576;
              while (1) {
                if ((j | 0) <= 1) {
                  n = 10;
                  break;
                }
                if (c[(e + ((j + -1) << 2)) >> 2] | 0) {
                  n = 13;
                  break;
                }
                b = (j + -2) | 0;
                if (!(c[(e + (b << 2)) >> 2] | 0)) j = b;
                else {
                  n = 13;
                  break;
                }
              }
              do
                if ((n | 0) == 10) {
                  c[M >> 2] = 0;
                  n = 20;
                } else if ((n | 0) == 13) {
                  c[M >> 2] = 0;
                  if ((j | 0) > 3) {
                    l = 0;
                    while (1) {
                      if ((c[(e + ((j + -1) << 2)) >> 2] | 0) >= 2) {
                        n = 21;
                        break;
                      }
                      if ((c[(e + ((j + -2) << 2)) >> 2] | 0) >= 2) {
                        n = 21;
                        break;
                      }
                      if ((c[(e + ((j + -3) << 2)) >> 2] | 0) >= 2) {
                        n = 21;
                        break;
                      }
                      b = (j + -4) | 0;
                      k = (l + 1) | 0;
                      if ((c[(e + (b << 2)) >> 2] | 0) >= 2) {
                        n = 21;
                        break;
                      }
                      c[M >> 2] = k;
                      if ((b | 0) > 3) {
                        j = b;
                        l = k;
                      } else {
                        n = 15;
                        break;
                      }
                    }
                    if ((n | 0) == 15) {
                      s = b >> 1;
                      c[O >> 2] = s;
                      j = b;
                      b = s;
                    } else if ((n | 0) == 21) {
                      b = j >>> 1;
                      c[O >> 2] = b;
                      if (!l) {
                        c[u >> 2] = 1;
                        b = 0;
                        n = 27;
                        break;
                      } else k = l;
                    }
                    l = 0;
                    n = j;
                    o = 0;
                    m = 0;
                    while (1) {
                      q = c[(e + (n << 2)) >> 2] | 0;
                      p = c[(e + ((n | 1) << 2)) >> 2] | 0;
                      R = c[(e + ((n + 2) << 2)) >> 2] | 0;
                      r = c[(e + ((n + 3) << 2)) >> 2] | 0;
                      s = ((p << 1) + q + (R << 2) + (r << 3)) | 0;
                      q = (q | 0) != 0;
                      r =
                        ((((R | 0) != 0) & 1) +
                          ((p | 0) == 0 ? q & 1 : q ? 2 : 1) +
                          (((r | 0) != 0) & 1)) |
                        0;
                      l = ((d[(G + s) >> 0] | 0) + l + r) | 0;
                      m = (r + m + (d[(H + s) >> 0] | 0)) | 0;
                      o = (o + 1) | 0;
                      if ((o | 0) == (k | 0)) {
                        k = b;
                        n = 25;
                        break;
                      } else n = (n + 4) | 0;
                    }
                  } else n = 20;
                }
              while (0);
              if ((n | 0) == 20) {
                k = j >> 1;
                c[O >> 2] = k;
                m = 0;
                l = 0;
                n = 25;
              }
              if ((n | 0) == 25) {
                n = 0;
                R = (l | 0) < (m | 0);
                b = R ? l : m;
                c[u >> 2] = (R ^ 1) & 1;
                if (!k) {
                  c[v >> 2] = 0;
                  c[w >> 2] = 0;
                  s = b;
                  l = c[C >> 2] | 0;
                } else n = 27;
              }
              if ((n | 0) == 27) {
                m = c[F >> 2] | 0;
                l = 0;
                while (1)
                  if (
                    (c[(1464 + ((m * 92) | 0) + (l << 2)) >> 2] | 0) <
                    (j | 0)
                  )
                    l = (l + 1) | 0;
                  else break;
                k = c[(824 + (l << 3)) >> 2] | 0;
                while (1) {
                  n = (1464 + ((m * 92) | 0) + ((k + 1) << 2)) | 0;
                  o = c[n >> 2] | 0;
                  if (((k | 0) != 0) & ((o | 0) > (j | 0))) k = (k + -1) | 0;
                  else break;
                }
                c[v >> 2] = k;
                c[C >> 2] = o;
                k = c[(824 + (l << 3) + 4) >> 2] | 0;
                while (1) {
                  l = c[(n + ((k + 1) << 2)) >> 2] | 0;
                  if (((k | 0) != 0) & ((l | 0) > (j | 0))) k = (k + -1) | 0;
                  else break;
                }
                c[w >> 2] = k;
                c[D >> 2] = l;
                c[E >> 2] = j;
                s = b;
                l = o;
              }
              c[x >> 2] = 0;
              c[z >> 2] = 0;
              c[A >> 2] = 0;
              if (!l) m = 0;
              else {
                m = xa(e, 0, l) | 0;
                c[x >> 2] = m;
              }
              k = c[D >> 2] | 0;
              p = k >>> 0 > l >>> 0;
              if (p) {
                q = xa(e, l, k) | 0;
                c[z >> 2] = q;
              } else q = 0;
              if (j >>> 0 > k >>> 0) {
                r = xa(e, k, j) | 0;
                c[A >> 2] = r;
              } else r = 0;
              do
                if (m) {
                  o = c[(8 + ((m * 24) | 0) + 4) >> 2] | 0;
                  n = c[(8 + ((m * 24) | 0) + 8) >> 2] | 0;
                  b = (l | 0) != 0;
                  if (m >>> 0 > 15) {
                    if (!b) {
                      b = 0;
                      break;
                    }
                    m = c[(8 + ((m * 24) | 0) + 20) >> 2] | 0;
                    b = 0;
                    j = 0;
                    do {
                      S = c[(e + (j << 2)) >> 2] | 0;
                      R = c[(e + ((j | 1) << 2)) >> 2] | 0;
                      U = (S | 0) > 14;
                      S = U ? 15 : S;
                      T = (R | 0) > 14;
                      R = T ? 15 : R;
                      b =
                        ((U ? n : 0) +
                          b +
                          (T ? n : 0) +
                          (d[(m + ((N(S, o) | 0) + R)) >> 0] | 0) +
                          (((S | 0) != 0) & 1) +
                          (((R | 0) != 0) & 1)) |
                        0;
                      j = (j + 2) | 0;
                    } while (j >>> 0 < l >>> 0);
                  } else {
                    if (!b) {
                      b = 0;
                      break;
                    }
                    m = c[(8 + ((m * 24) | 0) + 20) >> 2] | 0;
                    j = 0;
                    b = 0;
                    do {
                      T = c[(e + (j << 2)) >> 2] | 0;
                      U = c[(e + ((j | 1) << 2)) >> 2] | 0;
                      b =
                        ((((T | 0) != 0) & 1) +
                          b +
                          (((U | 0) != 0) & 1) +
                          (d[(m + ((N(T, o) | 0) + U)) >> 0] | 0)) |
                        0;
                      j = (j + 2) | 0;
                    } while (j >>> 0 < l >>> 0);
                  }
                } else b = 0;
              while (0);
              if (q) {
                o = c[(8 + ((q * 24) | 0) + 4) >> 2] | 0;
                n = c[(8 + ((q * 24) | 0) + 8) >> 2] | 0;
                if (q >>> 0 > 15)
                  if (p) {
                    m = c[(8 + ((q * 24) | 0) + 20) >> 2] | 0;
                    j = 0;
                    do {
                      T = c[(e + (l << 2)) >> 2] | 0;
                      U = c[(e + ((l + 1) << 2)) >> 2] | 0;
                      R = (T | 0) > 14;
                      T = R ? 15 : T;
                      S = (U | 0) > 14;
                      U = S ? 15 : U;
                      j =
                        ((R ? n : 0) +
                          j +
                          (S ? n : 0) +
                          (d[(m + ((N(T, o) | 0) + U)) >> 0] | 0) +
                          (((T | 0) != 0) & 1) +
                          (((U | 0) != 0) & 1)) |
                        0;
                      l = (l + 2) | 0;
                    } while (l >>> 0 < k >>> 0);
                  } else j = 0;
                else if (p) {
                  m = c[(8 + ((q * 24) | 0) + 20) >> 2] | 0;
                  j = 0;
                  do {
                    T = c[(e + (l << 2)) >> 2] | 0;
                    U = c[(e + ((l + 1) << 2)) >> 2] | 0;
                    j =
                      ((((T | 0) != 0) & 1) +
                        j +
                        (((U | 0) != 0) & 1) +
                        (d[(m + ((N(T, o) | 0) + U)) >> 0] | 0)) |
                      0;
                    l = (l + 2) | 0;
                  } while (l >>> 0 < k >>> 0);
                } else j = 0;
                b = (j + b) | 0;
              }
              if (r) {
                n = c[E >> 2] | 0;
                o = c[(8 + ((r * 24) | 0) + 4) >> 2] | 0;
                m = c[(8 + ((r * 24) | 0) + 8) >> 2] | 0;
                j = k >>> 0 < n >>> 0;
                if (r >>> 0 > 15)
                  if (j) {
                    l = c[(8 + ((r * 24) | 0) + 20) >> 2] | 0;
                    j = 0;
                    do {
                      T = c[(e + (k << 2)) >> 2] | 0;
                      U = c[(e + ((k + 1) << 2)) >> 2] | 0;
                      R = (T | 0) > 14;
                      T = R ? 15 : T;
                      S = (U | 0) > 14;
                      U = S ? 15 : U;
                      j =
                        ((R ? m : 0) +
                          j +
                          (S ? m : 0) +
                          (d[(l + ((N(T, o) | 0) + U)) >> 0] | 0) +
                          (((T | 0) != 0) & 1) +
                          (((U | 0) != 0) & 1)) |
                        0;
                      k = (k + 2) | 0;
                    } while (k >>> 0 < n >>> 0);
                  } else j = 0;
                else if (j) {
                  l = c[(8 + ((r * 24) | 0) + 20) >> 2] | 0;
                  j = 0;
                  do {
                    T = c[(e + (k << 2)) >> 2] | 0;
                    U = c[(e + ((k + 1) << 2)) >> 2] | 0;
                    j =
                      ((((T | 0) != 0) & 1) +
                        j +
                        (((U | 0) != 0) & 1) +
                        (d[(l + ((N(T, o) | 0) + U)) >> 0] | 0)) |
                      0;
                    k = (k + 2) | 0;
                  } while (k >>> 0 < n >>> 0);
                } else j = 0;
                b = (j + b) | 0;
              }
              b = (b + s) | 0;
            } else b = 1e5;
          } else b = 1e5;
          U = (b | 0) < (a | 0);
          P = U ? P : J;
          t = U ? I : (t - I) | 0;
        } while ((t | 0) > 1);
        l = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0)) | 0;
        c[(i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 72) >> 2] = P;
        b = c[(i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 16) >> 2] | 0;
        k = c[(1044 + (b << 2)) >> 2] | 0;
        b = c[(1108 + (b << 2)) >> 2] | 0;
        if (f) {
          j = (b * 5) | 0;
          b =
            (((c[(i + 124 + (g << 4) + 4) >> 2] | 0) == 0 ? (k * 5) | 0 : 0) +
              ((c[(i + 124 + (g << 4)) >> 2] | 0) == 0 ? (k * 6) | 0 : 0) +
              ((c[(i + 124 + (g << 4) + 8) >> 2] | 0) == 0 ? j : 0)) |
            0;
          if (c[(i + 124 + (g << 4) + 12) >> 2] | 0) {
            U = b;
            T = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 52) | 0;
            c[T >> 2] = U;
            U = (a - U) | 0;
            U = wa(e, U, l, 0, 0, i) | 0;
            T = c[T >> 2] | 0;
            U = (T + U) | 0;
            c[l >> 2] = U;
            return U | 0;
          }
        } else {
          j = (b * 5) | 0;
          b = (j + ((k * 11) | 0)) | 0;
        }
        U = (b + j) | 0;
        T = (i + 156 + ((f * 184) | 0) + ((g * 92) | 0) + 52) | 0;
        c[T >> 2] = U;
        U = (a - U) | 0;
        U = wa(e, U, l, 0, 0, i) | 0;
        T = c[T >> 2] | 0;
        U = (T + U) | 0;
        c[l >> 2] = U;
        return U | 0;
      }
      function za(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0.0,
          i = 0,
          j = 0,
          k = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0;
        F = l;
        l = (l + 672) | 0;
        t = F;
        b = c[a >> 2] | 0;
        if (!b) {
          Pa(a);
          l = F;
          return;
        }
        z = (a + 16) | 0;
        A = (a + 34488) | 0;
        B = (a + 39100) | 0;
        C = (a + 8) | 0;
        D = (a + 72) | 0;
        E = (a + 39452) | 0;
        u = (a + 39448) | 0;
        v = (a + 39104) | 0;
        w = (a + 39108) | 0;
        x = (b * 23) | 0;
        d = c[z >> 2] | 0;
        s = 0;
        while (1) {
          r = (x + (N(s, -23) | 0)) | 0;
          b = (b + -1) | 0;
          if ((d | 0) > 0) {
            q = (a + ((b << 4) + 124)) | 0;
            p = 0;
            while (1) {
              o = (a + 140 + ((r + ((p * 46) | 0)) << 2)) | 0;
              c[A >> 2] = a + 25264 + ((b * 4608) | 0) + ((p * 2304) | 0);
              d = 576;
              e = 0;
              a: while (1) {
                c[B >> 2] = e;
                while (1) {
                  f = (d + -1) | 0;
                  if (!d) break a;
                  n = c[((c[A >> 2] | 0) + (f << 2)) >> 2] | 0;
                  e = (((n | 0) < 0) << 31) >> 31;
                  e = rb(n | 0, e | 0, n | 0, e | 0) | 0;
                  e = nb(e | 0, y | 0, 1073741824, 0) | 0;
                  e = pb(e | 0, y | 0, 31) | 0;
                  c[(a + 34492 + (f << 2)) >> 2] = e;
                  e = c[((c[A >> 2] | 0) + (f << 2)) >> 2] | 0;
                  e = (e | 0) > -1 ? e : (0 - e) | 0;
                  c[(a + 36796 + (f << 2)) >> 2] = e;
                  if ((e | 0) > (c[B >> 2] | 0)) {
                    d = f;
                    continue a;
                  } else d = f;
                }
              }
              m = (a + 2224 + ((b * 4608) | 0) + ((p * 2304) | 0)) | 0;
              n = (a + 156 + ((p * 184) | 0) + ((b * 92) | 0)) | 0;
              c[(a + 156 + ((p * 184) | 0) + ((b * 92) | 0) + 56) >> 2] = 21;
              ob((t + ((p * 336) | 0) + ((b * 168) | 0)) | 0, 0, 168) | 0;
              b: do
                if ((c[C >> 2] | 0) == 3) {
                  k = c[D >> 2] | 0;
                  c[(a + 39448 + (p << 2)) >> 2] = c[B >> 2];
                  d = 0;
                  e = 575;
                  while (1) {
                    d = ((c[(a + 34492 + (e << 2)) >> 2] >> 10) + d) | 0;
                    if (!e) break;
                    else e = (e + -1) | 0;
                  }
                  if (!d) d = 0;
                  else d = ~~(+L(+(+(d | 0) * 4.768371584e-7)) / 0.69314718);
                  c[(a + 39104 + (p << 2)) >> 2] = d;
                  i = 20;
                  j = c[(1464 + ((k * 92) | 0) + 84) >> 2] | 0;
                  while (1) {
                    f = j;
                    j = c[(1464 + ((k * 92) | 0) + (i << 2)) >> 2] | 0;
                    if ((j | 0) < (f | 0)) {
                      d = 0;
                      e = j;
                      do {
                        d = ((c[(a + 34492 + (e << 2)) >> 2] >> 10) + d) | 0;
                        e = (e + 1) | 0;
                      } while ((e | 0) != (f | 0));
                      if (d)
                        d = ~~(+L(+(+(d | 0) * 4.768371584e-7)) / 0.69314718);
                      else d = 0;
                    } else d = 0;
                    c[(a + 39112 + ((p * 84) | 0) + (i << 2)) >> 2] = d;
                    g = +h[
                      (t + ((p * 336) | 0) + ((b * 168) | 0) + (i << 3)) >> 3
                    ];
                    if (g != 0.0) d = ~~(+L(+g) / 0.69314718);
                    else d = 0;
                    c[(a + 39280 + ((p * 84) | 0) + (i << 2)) >> 2] = d;
                    if (!i) break;
                    else i = (i + -1) | 0;
                  }
                  if ((p | 0) == 1) {
                    j = (c[u >> 2] | 0) != 0;
                    e = c[E >> 2] | 0 ? 3 : 2;
                    i = ((c[v >> 2] | 0) - (c[w >> 2] | 0)) | 0;
                    i = (((i | 0) > -1 ? i : (0 - i) | 0) | 0) < 10;
                    d = 0;
                    f = 20;
                    while (1) {
                      k =
                        ((c[(a + 39112 + (f << 2)) >> 2] | 0) -
                          (c[(a + 39196 + (f << 2)) >> 2] | 0)) |
                        0;
                      d = (((k | 0) > -1 ? k : (0 - k) | 0) + d) | 0;
                      if (!f) break;
                      else f = (f + -1) | 0;
                    }
                    if (
                      (((j & 1) + e + (i & 1) + (((d | 0) < 100) & 1)) | 0) ==
                      6
                    ) {
                      d = 0;
                      e = 0;
                    } else {
                      c[q >> 2] = 0;
                      c[(q + 4) >> 2] = 0;
                      c[(q + 8) >> 2] = 0;
                      c[(q + 12) >> 2] = 0;
                      break;
                    }
                    do {
                      while (1) {
                        k = (a + 124 + (b << 4) + (d << 2)) | 0;
                        c[k >> 2] = 0;
                        d = (d + 1) | 0;
                        j = e;
                        e = c[(1008 + (d << 2)) >> 2] | 0;
                        if ((j | 0) < (e | 0)) {
                          f = 0;
                          i = 0;
                          do {
                            G =
                              ((c[(a + 39112 + (j << 2)) >> 2] | 0) -
                                (c[(a + 39196 + (j << 2)) >> 2] | 0)) |
                              0;
                            f = (((G | 0) > -1 ? G : (0 - G) | 0) + f) | 0;
                            G =
                              ((c[(a + 39280 + (j << 2)) >> 2] | 0) -
                                (c[(a + 39364 + (j << 2)) >> 2] | 0)) |
                              0;
                            i = (((G | 0) > -1 ? G : (0 - G) | 0) + i) | 0;
                            j = (j + 1) | 0;
                          } while ((j | 0) != (e | 0));
                        } else {
                          i = 0;
                          f = 0;
                        }
                        if (((f | 0) < 10) & ((i | 0) < 10)) break;
                        c[k >> 2] = 0;
                        if ((d | 0) >= 4) break b;
                      }
                      c[k >> 2] = 1;
                    } while ((d | 0) < 4);
                  }
                }
              while (0);
              d = Na((a + 2192 + (b << 4) + (p << 3)) | 0, a) | 0;
              e = (a + 1208 + ((p * 176) | 0) + ((b * 88) | 0)) | 0;
              f = (e + 88) | 0;
              do {
                c[e >> 2] = 0;
                e = (e + 4) | 0;
              } while ((e | 0) < (f | 0));
              ob((a + 1560 + ((p * 312) | 0) + ((b * 156) | 0)) | 0, 0, 156) |
                0;
              c[o >> 2] = 0;
              c[(o + 4) >> 2] = 0;
              c[(o + 8) >> 2] = 0;
              c[(o + 12) >> 2] = 0;
              c[n >> 2] = 0;
              c[(a + 156 + ((p * 184) | 0) + ((b * 92) | 0) + 4) >> 2] = 0;
              c[(a + 156 + ((p * 184) | 0) + ((b * 92) | 0) + 8) >> 2] = 0;
              e = (a + 156 + ((p * 184) | 0) + ((b * 92) | 0) + 16) | 0;
              f = (e + 40) | 0;
              do {
                c[e >> 2] = 0;
                e = (e + 4) | 0;
              } while ((e | 0) < (f | 0));
              if (c[B >> 2] | 0) c[n >> 2] = ya(d, 0, m, p, b, a) | 0;
              Oa(n, a);
              c[(a + 156 + ((p * 184) | 0) + ((b * 92) | 0) + 12) >> 2] =
                (c[(a + 156 + ((p * 184) | 0) + ((b * 92) | 0) + 72) >> 2] |
                  0) +
                210;
              p = (p + 1) | 0;
              d = c[z >> 2] | 0;
              if ((p | 0) >= (d | 0)) break;
            }
          }
          if (!b) break;
          else s = (s + 1) | 0;
        }
        Pa(a);
        l = F;
        return;
      }
      function Aa(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0.0;
        b = 128;
        d = 127;
        while (1) {
          e = +Y(+(+((128 - b) | 0) * 0.25));
          h[(a + 39456 + (d << 3)) >> 3] = e;
          e = e * 2.0;
          c[(a + 40480 + (d << 2)) >> 2] =
            e > 2147483647.0 ? 2147483647 : ~~(e + 0.5);
          if (!d) {
            b = 9999;
            break;
          } else {
            b = d;
            d = (d + -1) | 0;
          }
        }
        while (1) {
          e = +(b | 0);
          c[(a + 40992 + (b << 2)) >> 2] = ~~(
            +B(+(e * +B(+e))) +
            -0.0946 +
            0.5
          );
          if (!b) break;
          else b = (b + -1) | 0;
        }
        return;
      }
      function Ba(a) {
        a = a | 0;
        var b = 0,
          d = 0.0,
          e = 0;
        b = 17;
        while (1) {
          d = +((b << 1) | 1 | 0);
          e = 35;
          while (1) {
            c[(a + 80992 + ((b * 144) | 0) + (e << 2)) >> 2] = ~~(
              +E(+((+(e | 0) + 0.5) * 0.087266462599717)) *
              +D(+(d * (+(((e << 1) + 19) | 0) * 0.043633231299858195))) *
              2147483647.0
            );
            if (!e) break;
            else e = (e + -1) | 0;
          }
          if (!b) break;
          else b = (b + -1) | 0;
        }
        return;
      }
      function Ca(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0;
        s = l;
        l = (l + 144) | 0;
        p = s;
        d = c[a >> 2] | 0;
        if (!d) {
          l = s;
          return;
        }
        q = (a + 16) | 0;
        r = (p + 140) | 0;
        do {
          d = (d + -1) | 0;
          e = c[q >> 2] | 0;
          if ((e | 0) > 0) {
            o = (a + 2184 + (d << 2)) | 0;
            n = 0;
            do {
              m = (a + 25264 + ((d * 4608) | 0) + ((n * 2304) | 0)) | 0;
              k = n;
              n = (n + 1) | 0;
              e = 0;
              do {
                Ea(
                  o,
                  (a + 11440 + ((d * 6912) | 0) + ((n * 2304) | 0) + (e << 7)) |
                    0,
                  d,
                  a,
                  b
                );
                j = e | 1;
                Ea(
                  o,
                  (a + 11440 + ((d * 6912) | 0) + ((n * 2304) | 0) + (j << 7)) |
                    0,
                  d,
                  a,
                  b
                );
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    4) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    12) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    20) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    28) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    36) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    44) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    52) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    60) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    68) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    76) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    84) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    92) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    100) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    108) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                i =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    116) |
                  0;
                c[i >> 2] = 0 - (c[i >> 2] | 0);
                j =
                  (a +
                    11440 +
                    ((d * 6912) | 0) +
                    ((n * 2304) | 0) +
                    (j << 7) +
                    124) |
                  0;
                c[j >> 2] = 0 - (c[j >> 2] | 0);
                e = (e + 2) | 0;
              } while ((e | 0) < 18);
              j = 0;
              while (1) {
                e = 18;
                f = 17;
                while (1) {
                  c[(p + (f << 2)) >> 2] =
                    c[
                      (a +
                        11440 +
                        ((d * 6912) | 0) +
                        ((k * 2304) | 0) +
                        (f << 7) +
                        (j << 2)) >>
                        2
                    ];
                  c[(p + ((e + 17) << 2)) >> 2] =
                    c[
                      (a +
                        11440 +
                        ((d * 6912) | 0) +
                        ((n * 2304) | 0) +
                        (f << 7) +
                        (j << 2)) >>
                        2
                    ];
                  if (!f) break;
                  else {
                    e = f;
                    f = (f + -1) | 0;
                  }
                }
                g = c[r >> 2] | 0;
                h = (((g | 0) < 0) << 31) >> 31;
                i = 17;
                while (1) {
                  e = c[(a + 80992 + ((i * 144) | 0) + 140) >> 2] | 0;
                  rb(e | 0, ((((e | 0) < 0) << 31) >> 31) | 0, g | 0, h | 0) |
                    0;
                  e = 35;
                  f = y;
                  do {
                    v = (e + -1) | 0;
                    t = c[(p + (v << 2)) >> 2] | 0;
                    v = c[(a + 80992 + ((i * 144) | 0) + (v << 2)) >> 2] | 0;
                    rb(
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0,
                      t | 0,
                      ((((t | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    t = (y + f) | 0;
                    v = (e + -2) | 0;
                    u = c[(p + (v << 2)) >> 2] | 0;
                    v = c[(a + 80992 + ((i * 144) | 0) + (v << 2)) >> 2] | 0;
                    rb(
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0,
                      u | 0,
                      ((((u | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    t = (t + y) | 0;
                    u = (e + -3) | 0;
                    v = c[(p + (u << 2)) >> 2] | 0;
                    u = c[(a + 80992 + ((i * 144) | 0) + (u << 2)) >> 2] | 0;
                    rb(
                      u | 0,
                      ((((u | 0) < 0) << 31) >> 31) | 0,
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    t = (t + y) | 0;
                    v = (e + -4) | 0;
                    u = c[(p + (v << 2)) >> 2] | 0;
                    v = c[(a + 80992 + ((i * 144) | 0) + (v << 2)) >> 2] | 0;
                    rb(
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0,
                      u | 0,
                      ((((u | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    t = (t + y) | 0;
                    u = (e + -5) | 0;
                    v = c[(p + (u << 2)) >> 2] | 0;
                    u = c[(a + 80992 + ((i * 144) | 0) + (u << 2)) >> 2] | 0;
                    rb(
                      u | 0,
                      ((((u | 0) < 0) << 31) >> 31) | 0,
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    t = (t + y) | 0;
                    v = (e + -6) | 0;
                    u = c[(p + (v << 2)) >> 2] | 0;
                    v = c[(a + 80992 + ((i * 144) | 0) + (v << 2)) >> 2] | 0;
                    rb(
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0,
                      u | 0,
                      ((((u | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    t = (t + y) | 0;
                    e = (e + -7) | 0;
                    u = c[(p + (e << 2)) >> 2] | 0;
                    v = c[(a + 80992 + ((i * 144) | 0) + (e << 2)) >> 2] | 0;
                    rb(
                      v | 0,
                      ((((v | 0) < 0) << 31) >> 31) | 0,
                      u | 0,
                      ((((u | 0) < 0) << 31) >> 31) | 0
                    ) | 0;
                    f = (t + y) | 0;
                  } while ((e | 0) != 0);
                  c[(m + ((j * 72) | 0) + (i << 2)) >> 2] = f;
                  if (!i) break;
                  else i = (i + -1) | 0;
                }
                if (!j) {
                  j = 1;
                  continue;
                }
                v = (m + ((j * 72) | 0)) | 0;
                e = c[v >> 2] | 0;
                u = (((e | 0) < 0) << 31) >> 31;
                w = rb(e | 0, u | 0, 1841452035, 0) | 0;
                i = y;
                t = (j + -1) | 0;
                h = (m + ((t * 72) | 0) + 68) | 0;
                g = c[h >> 2] | 0;
                f = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, f | 0, 1104871221, 0) | 0;
                i = nb(x | 0, y | 0, w | 0, i | 0) | 0;
                i = pb(i | 0, y | 0, 31) | 0;
                u = rb(e | 0, u | 0, -1104871221, -1) | 0;
                e = y;
                f = rb(g | 0, f | 0, 1841452035, 0) | 0;
                e = nb(f | 0, y | 0, u | 0, e | 0) | 0;
                e = pb(e | 0, y | 0, 31) | 0;
                c[h >> 2] = e;
                c[v >> 2] = i;
                v = (m + ((j * 72) | 0) + 4) | 0;
                i = c[v >> 2] | 0;
                h = (((i | 0) < 0) << 31) >> 31;
                e = rb(i | 0, h | 0, 1893526520, 0) | 0;
                u = y;
                f = (m + ((t * 72) | 0) + 64) | 0;
                g = c[f >> 2] | 0;
                w = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, w | 0, 1013036688, 0) | 0;
                u = nb(x | 0, y | 0, e | 0, u | 0) | 0;
                u = pb(u | 0, y | 0, 31) | 0;
                h = rb(i | 0, h | 0, -1013036688, -1) | 0;
                i = y;
                w = rb(g | 0, w | 0, 1893526520, 0) | 0;
                i = nb(w | 0, y | 0, h | 0, i | 0) | 0;
                i = pb(i | 0, y | 0, 31) | 0;
                c[f >> 2] = i;
                c[v >> 2] = u;
                v = (m + ((j * 72) | 0) + 8) | 0;
                u = c[v >> 2] | 0;
                f = (((u | 0) < 0) << 31) >> 31;
                i = rb(u | 0, f | 0, 2039311994, 0) | 0;
                h = y;
                w = (m + ((t * 72) | 0) + 60) | 0;
                g = c[w >> 2] | 0;
                e = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, e | 0, 672972958, 0) | 0;
                h = nb(x | 0, y | 0, i | 0, h | 0) | 0;
                h = pb(h | 0, y | 0, 31) | 0;
                f = rb(u | 0, f | 0, -672972958, -1) | 0;
                u = y;
                e = rb(g | 0, e | 0, 2039311994, 0) | 0;
                u = nb(e | 0, y | 0, f | 0, u | 0) | 0;
                u = pb(u | 0, y | 0, 31) | 0;
                c[w >> 2] = u;
                c[v >> 2] = h;
                v = (m + ((j * 72) | 0) + 12) | 0;
                h = c[v >> 2] | 0;
                w = (((h | 0) < 0) << 31) >> 31;
                u = rb(h | 0, w | 0, 2111652007, 0) | 0;
                f = y;
                e = (m + ((t * 72) | 0) + 56) | 0;
                g = c[e >> 2] | 0;
                i = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, i | 0, 390655621, 0) | 0;
                f = nb(x | 0, y | 0, u | 0, f | 0) | 0;
                f = pb(f | 0, y | 0, 31) | 0;
                w = rb(h | 0, w | 0, -390655621, -1) | 0;
                h = y;
                i = rb(g | 0, i | 0, 2111652007, 0) | 0;
                h = nb(i | 0, y | 0, w | 0, h | 0) | 0;
                h = pb(h | 0, y | 0, 31) | 0;
                c[e >> 2] = h;
                c[v >> 2] = f;
                v = (m + ((j * 72) | 0) + 16) | 0;
                f = c[v >> 2] | 0;
                e = (((f | 0) < 0) << 31) >> 31;
                h = rb(f | 0, e | 0, 2137858230, 0) | 0;
                w = y;
                i = (m + ((t * 72) | 0) + 52) | 0;
                g = c[i >> 2] | 0;
                u = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, u | 0, 203096531, 0) | 0;
                w = nb(x | 0, y | 0, h | 0, w | 0) | 0;
                w = pb(w | 0, y | 0, 31) | 0;
                e = rb(f | 0, e | 0, -203096531, -1) | 0;
                f = y;
                u = rb(g | 0, u | 0, 2137858230, 0) | 0;
                f = nb(u | 0, y | 0, e | 0, f | 0) | 0;
                f = pb(f | 0, y | 0, 31) | 0;
                c[i >> 2] = f;
                c[v >> 2] = w;
                v = (m + ((j * 72) | 0) + 20) | 0;
                w = c[v >> 2] | 0;
                i = (((w | 0) < 0) << 31) >> 31;
                f = rb(w | 0, i | 0, 2145680959, 0) | 0;
                e = y;
                u = (m + ((t * 72) | 0) + 48) | 0;
                g = c[u >> 2] | 0;
                h = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, h | 0, 87972919, 0) | 0;
                e = nb(x | 0, y | 0, f | 0, e | 0) | 0;
                e = pb(e | 0, y | 0, 31) | 0;
                i = rb(w | 0, i | 0, -87972919, -1) | 0;
                w = y;
                h = rb(g | 0, h | 0, 2145680959, 0) | 0;
                w = nb(h | 0, y | 0, i | 0, w | 0) | 0;
                w = pb(w | 0, y | 0, 31) | 0;
                c[u >> 2] = w;
                c[v >> 2] = e;
                v = (m + ((j * 72) | 0) + 24) | 0;
                e = c[v >> 2] | 0;
                u = (((e | 0) < 0) << 31) >> 31;
                w = rb(e | 0, u | 0, 2147267170, 0) | 0;
                i = y;
                h = (m + ((t * 72) | 0) + 44) | 0;
                g = c[h >> 2] | 0;
                f = (((g | 0) < 0) << 31) >> 31;
                x = rb(g | 0, f | 0, 30491193, 0) | 0;
                i = nb(x | 0, y | 0, w | 0, i | 0) | 0;
                i = pb(i | 0, y | 0, 31) | 0;
                u = rb(e | 0, u | 0, -30491193, -1) | 0;
                e = y;
                f = rb(g | 0, f | 0, 2147267170, 0) | 0;
                e = nb(f | 0, y | 0, u | 0, e | 0) | 0;
                e = pb(e | 0, y | 0, 31) | 0;
                c[h >> 2] = e;
                c[v >> 2] = i;
                v = (m + ((j * 72) | 0) + 28) | 0;
                i = c[v >> 2] | 0;
                h = (((i | 0) < 0) << 31) >> 31;
                e = rb(i | 0, h | 0, 2147468947, 0) | 0;
                u = y;
                t = (m + ((t * 72) | 0) + 40) | 0;
                f = c[t >> 2] | 0;
                g = (((f | 0) < 0) << 31) >> 31;
                w = rb(f | 0, g | 0, 7945635, 0) | 0;
                u = nb(w | 0, y | 0, e | 0, u | 0) | 0;
                u = pb(u | 0, y | 0, 31) | 0;
                h = rb(i | 0, h | 0, -7945635, -1) | 0;
                i = y;
                g = rb(f | 0, g | 0, 2147468947, 0) | 0;
                i = nb(g | 0, y | 0, h | 0, i | 0) | 0;
                i = pb(i | 0, y | 0, 31) | 0;
                c[t >> 2] = i;
                c[v >> 2] = u;
                j = (j + 1) | 0;
                if ((j | 0) == 32) break;
              }
              e = c[q >> 2] | 0;
            } while ((n | 0) < (e | 0));
          }
          tb(
            (a + 11440 + ((d * 6912) | 0)) | 0,
            (a + 11440 + ((d * 6912) | 0) + ((e * 2304) | 0)) | 0,
            2304
          ) | 0;
        } while ((d | 0) != 0);
        l = s;
        return;
      }
      function Da(a) {
        a = a | 0;
        var b = 0,
          d = 0.0,
          e = 0,
          f = 0,
          g = 0,
          i = 0,
          j = 0;
        j = l;
        l = (l + 16) | 0;
        e = j;
        c[(a + 83588) >> 2] = 0;
        c[(a + 83584) >> 2] = 0;
        ob((a + 91784) | 0, 0, 4096) | 0;
        g = 31;
        while (1) {
          i = (g << 1) | 1;
          b = 64;
          f = 63;
          while (1) {
            d = +D(+(+(N((17 - b) | 0, i) | 0) * 0.049087385212)) * 1.0e9;
            h[e >> 3] = d;
            if (!(d >= 0.0)) +bb(d + -0.5, e);
            else +bb(d + 0.5, e);
            c[(a + 83592 + (g << 8) + (f << 2)) >> 2] = ~~(
              +h[e >> 3] * 2.147483647
            );
            if (!f) break;
            else {
              b = f;
              f = (f + -1) | 0;
            }
          }
          if (!g) break;
          else g = (g + -1) | 0;
        }
        l = j;
        return;
      }
      function Ea(a, b, d, f, g) {
        a = a | 0;
        b = b | 0;
        d = d | 0;
        f = f | 0;
        g = g | 0;
        var h = 0,
          i = 0,
          j = 0,
          k = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0;
        p = l;
        l = (l + 256) | 0;
        o = p;
        j = c[a >> 2] | 0;
        n = (f + 83584 + (d << 2)) | 0;
        k = g << 5;
        h = j;
        i = 31;
        m = c[n >> 2] | 0;
        while (1) {
          c[(f + 91784 + (d << 11) + ((i + m) << 2)) >> 2] =
            (e[h >> 1] | 0) << 16;
          m = c[n >> 2] | 0;
          if (!i) break;
          else {
            h = (h + (g << 1)) | 0;
            i = (i + -1) | 0;
          }
        }
        c[a >> 2] = j + (k << 1);
        h = 64;
        a = 63;
        while (1) {
          j = (a + m) | 0;
          k = c[(f + 91784 + (d << 11) + ((j & 511) << 2)) >> 2] | 0;
          g = c[(2292 + (a << 2)) >> 2] | 0;
          rb(
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0,
            k | 0,
            ((((k | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = y;
          g = c[(f + 91784 + (d << 11) + (((j + 64) & 511) << 2)) >> 2] | 0;
          i = c[(2292 + ((h + 63) << 2)) >> 2] | 0;
          rb(
            i | 0,
            ((((i | 0) < 0) << 31) >> 31) | 0,
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = (y + k) | 0;
          g = c[(f + 91784 + (d << 11) + (((j + 128) & 511) << 2)) >> 2] | 0;
          i = c[(2292 + ((h + 127) << 2)) >> 2] | 0;
          rb(
            i | 0,
            ((((i | 0) < 0) << 31) >> 31) | 0,
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = (k + y) | 0;
          g = c[(f + 91784 + (d << 11) + (((j + 192) & 511) << 2)) >> 2] | 0;
          i = c[(2292 + ((h + 191) << 2)) >> 2] | 0;
          rb(
            i | 0,
            ((((i | 0) < 0) << 31) >> 31) | 0,
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = (k + y) | 0;
          g = c[(f + 91784 + (d << 11) + (((j + 256) & 511) << 2)) >> 2] | 0;
          i = c[(2292 + ((h + 255) << 2)) >> 2] | 0;
          rb(
            i | 0,
            ((((i | 0) < 0) << 31) >> 31) | 0,
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = (k + y) | 0;
          g = c[(f + 91784 + (d << 11) + (((j + 320) & 511) << 2)) >> 2] | 0;
          i = c[(2292 + ((h + 319) << 2)) >> 2] | 0;
          rb(
            i | 0,
            ((((i | 0) < 0) << 31) >> 31) | 0,
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = (k + y) | 0;
          g = c[(f + 91784 + (d << 11) + (((j + 384) & 511) << 2)) >> 2] | 0;
          i = c[(2292 + ((h + 383) << 2)) >> 2] | 0;
          rb(
            i | 0,
            ((((i | 0) < 0) << 31) >> 31) | 0,
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          k = (k + y) | 0;
          j = c[(f + 91784 + (d << 11) + (((j + 448) & 511) << 2)) >> 2] | 0;
          g = c[(2292 + ((h + 447) << 2)) >> 2] | 0;
          rb(
            g | 0,
            ((((g | 0) < 0) << 31) >> 31) | 0,
            j | 0,
            ((((j | 0) < 0) << 31) >> 31) | 0
          ) | 0;
          c[(o + (a << 2)) >> 2] = k + y;
          if (!a) break;
          else {
            h = a;
            a = (a + -1) | 0;
          }
        }
        c[n >> 2] = (m + 480) & 511;
        i = c[(o + 252) >> 2] | 0;
        g = (((i | 0) < 0) << 31) >> 31;
        j = 31;
        while (1) {
          h = c[(f + 83592 + (j << 8) + 252) >> 2] | 0;
          rb(i | 0, g | 0, h | 0, ((((h | 0) < 0) << 31) >> 31) | 0) | 0;
          h = y;
          a = 63;
          do {
            m = (a + -1) | 0;
            n = c[(f + 83592 + (j << 8) + (m << 2)) >> 2] | 0;
            m = c[(o + (m << 2)) >> 2] | 0;
            rb(
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0,
              n | 0,
              ((((n | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            n = (y + h) | 0;
            m = (a + -2) | 0;
            d = c[(f + 83592 + (j << 8) + (m << 2)) >> 2] | 0;
            m = c[(o + (m << 2)) >> 2] | 0;
            rb(
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0,
              d | 0,
              ((((d | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            n = (n + y) | 0;
            d = (a + -3) | 0;
            m = c[(f + 83592 + (j << 8) + (d << 2)) >> 2] | 0;
            d = c[(o + (d << 2)) >> 2] | 0;
            rb(
              d | 0,
              ((((d | 0) < 0) << 31) >> 31) | 0,
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            n = (n + y) | 0;
            m = (a + -4) | 0;
            d = c[(f + 83592 + (j << 8) + (m << 2)) >> 2] | 0;
            m = c[(o + (m << 2)) >> 2] | 0;
            rb(
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0,
              d | 0,
              ((((d | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            n = (n + y) | 0;
            d = (a + -5) | 0;
            m = c[(f + 83592 + (j << 8) + (d << 2)) >> 2] | 0;
            d = c[(o + (d << 2)) >> 2] | 0;
            rb(
              d | 0,
              ((((d | 0) < 0) << 31) >> 31) | 0,
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            n = (n + y) | 0;
            m = (a + -6) | 0;
            d = c[(f + 83592 + (j << 8) + (m << 2)) >> 2] | 0;
            m = c[(o + (m << 2)) >> 2] | 0;
            rb(
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0,
              d | 0,
              ((((d | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            n = (n + y) | 0;
            a = (a + -7) | 0;
            d = c[(f + 83592 + (j << 8) + (a << 2)) >> 2] | 0;
            m = c[(o + (a << 2)) >> 2] | 0;
            rb(
              m | 0,
              ((((m | 0) < 0) << 31) >> 31) | 0,
              d | 0,
              ((((d | 0) < 0) << 31) >> 31) | 0
            ) | 0;
            h = (n + y) | 0;
          } while ((a | 0) != 0);
          c[(b + (j << 2)) >> 2] = h;
          if (!j) break;
          else j = (j + -1) | 0;
        }
        l = p;
        return;
      }
      function Fa(a) {
        a = a | 0;
        c[(a + 4) >> 2] = 128;
        c[(a + 8) >> 2] = 0;
        c[(a + 12) >> 2] = 0;
        c[(a + 16) >> 2] = 1;
        return;
      }
      function Ga(a, b) {
        a = a | 0;
        b = b | 0;
        if ((c[(1208 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 0;
          return b | 0;
        }
        if ((c[(1224 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 1;
          return b | 0;
        }
        if ((c[(1240 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 2;
          return b | 0;
        }
        if ((c[(1256 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 3;
          return b | 0;
        }
        if ((c[(1272 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 4;
          return b | 0;
        }
        if ((c[(1288 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 5;
          return b | 0;
        }
        if ((c[(1304 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 6;
          return b | 0;
        }
        if ((c[(1320 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 7;
          return b | 0;
        }
        if ((c[(1336 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 8;
          return b | 0;
        }
        if ((c[(1352 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 9;
          return b | 0;
        }
        if ((c[(1368 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 10;
          return b | 0;
        }
        if ((c[(1384 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 11;
          return b | 0;
        }
        if ((c[(1400 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 12;
          return b | 0;
        }
        if ((c[(1416 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 13;
          return b | 0;
        }
        if ((c[(1432 + (b << 2)) >> 2] | 0) == (a | 0)) {
          b = 14;
          return b | 0;
        } else
          return ((c[(1448 + (b << 2)) >> 2] | 0) == (a | 0) ? 15 : -1) | 0;
        return 0;
      }
      function Ha(a, b) {
        a = a | 0;
        b = b | 0;
        if ((c[293] | 0) != (a | 0))
          if ((c[294] | 0) != (a | 0))
            if ((c[295] | 0) != (a | 0))
              if ((c[296] | 0) != (a | 0))
                if ((c[297] | 0) != (a | 0))
                  if ((c[298] | 0) != (a | 0))
                    if ((c[299] | 0) != (a | 0))
                      if ((c[300] | 0) != (a | 0))
                        if ((c[301] | 0) == (a | 0)) a = 8;
                        else {
                          b = -1;
                          return b | 0;
                        }
                      else a = 7;
                    else a = 6;
                  else a = 5;
                else a = 4;
              else a = 3;
            else a = 2;
          else a = 1;
        else a = 0;
        a = a >>> 0 < 3 ? 3 : a >>> 0 < 6 ? 2 : 0;
        b = (Ga(b, a) | 0) < 0;
        b = b ? -1 : a;
        return b | 0;
      }
      function Ia(a) {
        a = a | 0;
        return ((c[(a + 16) >> 2] | 0) * 576) | 0;
      }
      function Ja(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          i = 0,
          j = 0,
          k = 0.0;
        e = (a + 4) | 0;
        b = c[e >> 2] | 0;
        i = (a + 12) | 0;
        d = c[i >> 2] | 0;
        j = c[293] | 0;
        if ((j | 0) != (b | 0))
          if ((c[294] | 0) != (b | 0))
            if ((c[295] | 0) != (b | 0))
              if ((c[296] | 0) != (b | 0))
                if ((c[297] | 0) != (b | 0))
                  if ((c[298] | 0) != (b | 0))
                    if ((c[299] | 0) != (b | 0))
                      if ((c[300] | 0) != (b | 0))
                        if ((c[301] | 0) == (b | 0)) b = 8;
                        else {
                          j = 0;
                          return j | 0;
                        }
                      else b = 7;
                    else b = 6;
                  else b = 5;
                else b = 4;
              else b = 3;
            else b = 2;
          else b = 1;
        else b = 0;
        if ((Ga(d, b >>> 0 < 3 ? 3 : b >>> 0 < 6 ? 2 : 0) | 0) < 0) {
          j = 0;
          return j | 0;
        }
        g = ib(1, 95880) | 0;
        if (!g) {
          j = g;
          return j | 0;
        }
        Da(g);
        Ba(g);
        Aa(g);
        c[g >> 2] = c[a >> 2];
        f = c[e >> 2] | 0;
        c[(g + 4) >> 2] = f;
        d = (g + 8) | 0;
        c[(g + 20) >> 2] = c[(a + 8) >> 2];
        e = c[i >> 2] | 0;
        c[(g + 24) >> 2] = e;
        c[(g + 28) >> 2] = c[(a + 16) >> 2];
        c[(g + 88) >> 2] = c[(a + 20) >> 2];
        c[(g + 92) >> 2] = c[(a + 24) >> 2];
        c[(g + 34484) >> 2] = 0;
        c[(g + 34480) >> 2] = 0;
        c[(g + 12) >> 2] = 1;
        c[(g + 76) >> 2] = 0;
        c[(g + 80) >> 2] = 0;
        c[(g + 84) >> 2] = 0;
        c[(g + 40) >> 2] = 8;
        if ((j | 0) != (f | 0))
          if ((c[294] | 0) != (f | 0))
            if ((c[295] | 0) != (f | 0))
              if ((c[296] | 0) != (f | 0))
                if ((c[297] | 0) != (f | 0))
                  if ((c[298] | 0) != (f | 0))
                    if ((c[299] | 0) != (f | 0))
                      if ((c[300] | 0) == (f | 0)) b = 7;
                      else b = (c[301] | 0) == (f | 0) ? 8 : -1;
                    else b = 6;
                  else b = 5;
                else b = 4;
              else b = 3;
            else b = 2;
          else b = 1;
        else b = 0;
        c[(g + 72) >> 2] = b;
        j = (b | 0) < 3 ? 3 : (b | 0) < 6 ? 2 : 0;
        c[d >> 2] = j;
        c[(g + 68) >> 2] = Ga(e, j) | 0;
        j = c[(1028 + (j << 2)) >> 2] | 0;
        b = (g + 16) | 0;
        c[b >> 2] = j;
        k = ((+(j | 0) * 576.0) / +(f | 0)) * (+(e | 0) * 1.0e3 * 0.125);
        j = ~~k;
        c[(g + 64) >> 2] = j;
        k = k - +(j | 0);
        h[(g + 48) >> 3] = k;
        h[(g + 56) >> 3] = -k;
        if (k == 0.0) c[(g + 32) >> 2] = 0;
        ra((g + 96) | 0, 4096);
        ob((g + 116) | 0, 0, 408) | 0;
        j = (c[g >> 2] | 0) == 1;
        c[(g + 524) >> 2] =
          (c[b >> 2] | 0) == 2 ? (j ? 168 : 288) : j ? 104 : 168;
        j = g;
        return j | 0;
      }
      function Ka(a, b, d) {
        a = a | 0;
        b = b | 0;
        d = d | 0;
        var e = 0.0,
          f = 0,
          g = 0,
          i = 0.0;
        c[(a + 2184) >> 2] = c[b >> 2];
        if ((c[a >> 2] | 0) == 2) c[(a + 2188) >> 2] = c[(b + 4) >> 2];
        e = +h[(a + 48) >> 3];
        if (e != 0.0) {
          f = (a + 56) | 0;
          i = +h[f >> 3];
          g = i <= e + -1.0;
          b = g & 1;
          c[(a + 32) >> 2] = b;
          h[f >> 3] = i + (+(g & 1) - e);
        } else b = c[(a + 32) >> 2] | 0;
        g = ((c[(a + 64) >> 2] | 0) + b) << 3;
        c[(a + 36) >> 2] = g;
        c[(a + 528) >> 2] =
          (((g - (c[(a + 524) >> 2] | 0)) | 0) / (c[(a + 16) >> 2] | 0)) | 0;
        Ca(a, 1);
        za(a);
        va(a);
        g = (a + 104) | 0;
        c[d >> 2] = c[g >> 2];
        c[g >> 2] = 0;
        return c[(a + 96) >> 2] | 0;
      }
      function La(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0;
        d = (a + 104) | 0;
        c[b >> 2] = c[d >> 2];
        c[d >> 2] = 0;
        return c[(a + 96) >> 2] | 0;
      }
      function Ma(a) {
        a = a | 0;
        sa((a + 96) | 0);
        hb(a);
        return;
      }
      function Na(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0,
          e = 0,
          f = 0;
        d = ((c[(b + 528) >> 2] | 0) / (c[b >> 2] | 0)) | 0;
        e = (d | 0) < 4095 ? d : 4095;
        f = c[(b + 34484) >> 2] | 0;
        if (!f) {
          f = e;
          return f | 0;
        }
        a = ~~(+h[a >> 3] * 3.1 - +(d | 0));
        d = c[(b + 34480) >> 2] | 0;
        if ((a | 0) > 100) {
          b = (((d * 6) | 0) / 10) | 0;
          a = (b | 0) < (a | 0) ? b : a;
        } else a = 0;
        f = (d - ((((f << 3) | 0) / 10) | 0)) | 0;
        f = (((f | 0) > (a | 0) ? f : a) + e) | 0;
        f = (f | 0) < 4095 ? f : 4095;
        return f | 0;
      }
      function Oa(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0;
        d = (b + 34480) | 0;
        c[d >> 2] =
          (((c[(b + 528) >> 2] | 0) / (c[b >> 2] | 0)) | 0) -
          (c[a >> 2] | 0) +
          (c[d >> 2] | 0);
        return;
      }
      function Pa(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0;
        f = c[a >> 2] | 0;
        if ((f | 0) == 2 ? (c[(a + 528) >> 2] & 1) | 0 : 0) {
          h = (a + 34480) | 0;
          c[h >> 2] = (c[h >> 2] | 0) + 1;
        }
        h = (a + 34480) | 0;
        e = c[h >> 2] | 0;
        b = (e - (c[(a + 34484) >> 2] | 0)) | 0;
        b = (b | 0) > 0 ? b : 0;
        e = (e - b) | 0;
        g = (e | 0) % 8 | 0;
        b = (g + b) | 0;
        c[h >> 2] = e - g;
        if (!b) return;
        d = (a + 156) | 0;
        e = ((c[d >> 2] | 0) + b) | 0;
        if (e >>> 0 < 4095) {
          c[d >> 2] = e;
          return;
        }
        h = (a + 16) | 0;
        d = c[h >> 2] | 0;
        if ((d | 0) > 0) {
          g = 0;
          e = f;
          do {
            if ((e | 0) > 0) {
              f = 0;
              d = e;
              while (1) {
                if (!b) {
                  b = 0;
                  e = d;
                  break;
                }
                e = (a + 156 + ((g * 184) | 0) + ((f * 92) | 0)) | 0;
                i = c[e >> 2] | 0;
                d = (4095 - i) | 0;
                d = (d | 0) < (b | 0) ? d : b;
                c[e >> 2] = d + i;
                b = (b - d) | 0;
                f = (f + 1) | 0;
                d = c[a >> 2] | 0;
                if ((f | 0) >= (d | 0)) {
                  e = d;
                  break;
                }
              }
              d = c[h >> 2] | 0;
            }
            g = (g + 1) | 0;
          } while ((g | 0) < (d | 0));
        }
        c[(a + 120) >> 2] = b;
        return;
      }
      function Qa(a, b, d, e) {
        a = a | 0;
        b = b | 0;
        d = d | 0;
        e = e | 0;
        var f = 0,
          g = 0;
        f = l;
        l = (l + 32) | 0;
        g = f;
        c[g >> 2] = a;
        c[(g + 4) >> 2] = b;
        b = (g + 8) | 0;
        Fa(b);
        c[b >> 2] = d;
        c[(g + 12) >> 2] = e;
        e = Ja(g) | 0;
        l = f;
        return e | 0;
      }
      function Ra() {
        return 8944;
      }
      function Sa(a) {
        a = a | 0;
        var b = 0,
          d = 0;
        b = l;
        l = (l + 16) | 0;
        d = b;
        c[d >> 2] = Za(c[(a + 60) >> 2] | 0) | 0;
        a = Va(ba(6, d | 0) | 0) | 0;
        l = b;
        return a | 0;
      }
      function Ta(a, b, d) {
        a = a | 0;
        b = b | 0;
        d = d | 0;
        var e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0;
        n = l;
        l = (l + 48) | 0;
        k = (n + 16) | 0;
        g = n;
        f = (n + 32) | 0;
        i = (a + 28) | 0;
        e = c[i >> 2] | 0;
        c[f >> 2] = e;
        j = (a + 20) | 0;
        e = ((c[j >> 2] | 0) - e) | 0;
        c[(f + 4) >> 2] = e;
        c[(f + 8) >> 2] = b;
        c[(f + 12) >> 2] = d;
        e = (e + d) | 0;
        h = (a + 60) | 0;
        c[g >> 2] = c[h >> 2];
        c[(g + 4) >> 2] = f;
        c[(g + 8) >> 2] = 2;
        g = Va(ga(146, g | 0) | 0) | 0;
        a: do
          if ((e | 0) != (g | 0)) {
            b = 2;
            while (1) {
              if ((g | 0) < 0) break;
              e = (e - g) | 0;
              p = c[(f + 4) >> 2] | 0;
              o = g >>> 0 > p >>> 0;
              f = o ? (f + 8) | 0 : f;
              b = (((o << 31) >> 31) + b) | 0;
              p = (g - (o ? p : 0)) | 0;
              c[f >> 2] = (c[f >> 2] | 0) + p;
              o = (f + 4) | 0;
              c[o >> 2] = (c[o >> 2] | 0) - p;
              c[k >> 2] = c[h >> 2];
              c[(k + 4) >> 2] = f;
              c[(k + 8) >> 2] = b;
              g = Va(ga(146, k | 0) | 0) | 0;
              if ((e | 0) == (g | 0)) {
                m = 3;
                break a;
              }
            }
            c[(a + 16) >> 2] = 0;
            c[i >> 2] = 0;
            c[j >> 2] = 0;
            c[a >> 2] = c[a >> 2] | 32;
            if ((b | 0) == 2) d = 0;
            else d = (d - (c[(f + 4) >> 2] | 0)) | 0;
          } else m = 3;
        while (0);
        if ((m | 0) == 3) {
          p = c[(a + 44) >> 2] | 0;
          c[(a + 16) >> 2] = p + (c[(a + 48) >> 2] | 0);
          c[i >> 2] = p;
          c[j >> 2] = p;
        }
        l = n;
        return d | 0;
      }
      function Ua(a, b, d) {
        a = a | 0;
        b = b | 0;
        d = d | 0;
        var e = 0,
          f = 0,
          g = 0;
        f = l;
        l = (l + 32) | 0;
        g = f;
        e = (f + 20) | 0;
        c[g >> 2] = c[(a + 60) >> 2];
        c[(g + 4) >> 2] = 0;
        c[(g + 8) >> 2] = b;
        c[(g + 12) >> 2] = e;
        c[(g + 16) >> 2] = d;
        if ((Va(ca(140, g | 0) | 0) | 0) < 0) {
          c[e >> 2] = -1;
          a = -1;
        } else a = c[e >> 2] | 0;
        l = f;
        return a | 0;
      }
      function Va(a) {
        a = a | 0;
        if (a >>> 0 > 4294963200) {
          c[(Wa() | 0) >> 2] = 0 - a;
          a = -1;
        }
        return a | 0;
      }
      function Wa() {
        return ((Xa() | 0) + 64) | 0;
      }
      function Xa() {
        return Ya() | 0;
      }
      function Ya() {
        return 4340;
      }
      function Za(a) {
        a = a | 0;
        return a | 0;
      }
      function _a(b, d, e) {
        b = b | 0;
        d = d | 0;
        e = e | 0;
        var f = 0,
          g = 0;
        g = l;
        l = (l + 32) | 0;
        f = g;
        c[(b + 36) >> 2] = 3;
        if (
          ((c[b >> 2] & 64) | 0) == 0
            ? ((c[f >> 2] = c[(b + 60) >> 2]),
              (c[(f + 4) >> 2] = 21523),
              (c[(f + 8) >> 2] = g + 16),
              ea(54, f | 0) | 0)
            : 0
        )
          a[(b + 75) >> 0] = -1;
        f = Ta(b, d, e) | 0;
        l = g;
        return f | 0;
      }
      function $a(a) {
        a = a | 0;
        return 0;
      }
      function ab(a) {
        a = a | 0;
        return;
      }
      function bb(a, b) {
        a = +a;
        b = b | 0;
        var d = 0,
          e = 0,
          f = 0,
          g = 0,
          i = 0.0;
        h[j >> 3] = a;
        f = c[j >> 2] | 0;
        g = c[(j + 4) >> 2] | 0;
        d = pb(f | 0, g | 0, 52) | 0;
        d = d & 2047;
        e = (d + -1023) | 0;
        if ((e | 0) > 51) {
          h[b >> 3] = a;
          c[j >> 2] = 0;
          c[(j + 4) >> 2] = g & -2147483648;
          return +((((f | 0) == 0) & (((g & 1048575) | 0) == 0)) |
          ((e | 0) != 1024)
            ? +h[j >> 3]
            : a);
        }
        do
          if (d >>> 0 >= 1023) {
            d = pb(-1, 1048575, e | 0) | 0;
            e = y;
            if ((((d & f) | 0) == 0) & (((e & g) | 0) == 0)) {
              h[b >> 3] = a;
              c[j >> 2] = 0;
              c[(j + 4) >> 2] = g & -2147483648;
              a = +h[j >> 3];
              break;
            } else {
              d = f & ~d;
              f = g & ~e;
              c[j >> 2] = d;
              c[(j + 4) >> 2] = f;
              i = +h[j >> 3];
              g = b;
              c[g >> 2] = d;
              c[(g + 4) >> 2] = f;
              a = a - i;
              break;
            }
          } else {
            f = b;
            c[f >> 2] = 0;
            c[(f + 4) >> 2] = g & -2147483648;
          }
        while (0);
        return +a;
      }
      function cb() {
        Z(9008);
        return 9016;
      }
      function db() {
        fa(9008);
        return;
      }
      function eb(a) {
        a = a | 0;
        var b = 0,
          d = 0;
        do
          if (a) {
            if ((c[(a + 76) >> 2] | 0) <= -1) {
              b = fb(a) | 0;
              break;
            }
            d = ($a(a) | 0) == 0;
            b = fb(a) | 0;
            if (!d) ab(a);
          } else {
            if (!(c[1177] | 0)) b = 0;
            else b = eb(c[1177] | 0) | 0;
            a = c[(cb() | 0) >> 2] | 0;
            if (a)
              do {
                if ((c[(a + 76) >> 2] | 0) > -1) d = $a(a) | 0;
                else d = 0;
                if ((c[(a + 20) >> 2] | 0) >>> 0 > (c[(a + 28) >> 2] | 0) >>> 0)
                  b = fb(a) | 0 | b;
                if (d | 0) ab(a);
                a = c[(a + 56) >> 2] | 0;
              } while ((a | 0) != 0);
            db();
          }
        while (0);
        return b | 0;
      }
      function fb(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0;
        b = (a + 20) | 0;
        h = (a + 28) | 0;
        if (
          (c[b >> 2] | 0) >>> 0 > (c[h >> 2] | 0) >>> 0
            ? (ja[c[(a + 36) >> 2] & 3](a, 0, 0) | 0, (c[b >> 2] | 0) == 0)
            : 0
        )
          a = -1;
        else {
          d = (a + 4) | 0;
          e = c[d >> 2] | 0;
          f = (a + 8) | 0;
          g = c[f >> 2] | 0;
          if (e >>> 0 < g >>> 0)
            ja[c[(a + 40) >> 2] & 3](a, (e - g) | 0, 1) | 0;
          c[(a + 16) >> 2] = 0;
          c[h >> 2] = 0;
          c[b >> 2] = 0;
          c[f >> 2] = 0;
          c[d >> 2] = 0;
          a = 0;
        }
        return a | 0;
      }
      function gb(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0;
        K = l;
        l = (l + 16) | 0;
        o = K;
        do
          if (a >>> 0 < 245) {
            p = a >>> 0 < 11 ? 16 : (a + 11) & -8;
            a = p >>> 3;
            t = c[2255] | 0;
            d = t >>> a;
            if ((d & 3) | 0) {
              a = (((d & 1) ^ 1) + a) | 0;
              d = (9060 + ((a << 1) << 2)) | 0;
              e = (d + 8) | 0;
              f = c[e >> 2] | 0;
              g = (f + 8) | 0;
              h = c[g >> 2] | 0;
              do
                if ((d | 0) != (h | 0)) {
                  if (h >>> 0 < (c[2259] | 0) >>> 0) $();
                  b = (h + 12) | 0;
                  if ((c[b >> 2] | 0) == (f | 0)) {
                    c[b >> 2] = d;
                    c[e >> 2] = h;
                    break;
                  } else $();
                } else c[2255] = t & ~(1 << a);
              while (0);
              J = a << 3;
              c[(f + 4) >> 2] = J | 3;
              J = (f + J + 4) | 0;
              c[J >> 2] = c[J >> 2] | 1;
              J = g;
              l = K;
              return J | 0;
            }
            s = c[2257] | 0;
            if (p >>> 0 > s >>> 0) {
              if (d | 0) {
                i = 2 << a;
                a = (d << a) & (i | (0 - i));
                a = ((a & (0 - a)) + -1) | 0;
                i = (a >>> 12) & 16;
                a = a >>> i;
                e = (a >>> 5) & 8;
                a = a >>> e;
                g = (a >>> 2) & 4;
                a = a >>> g;
                d = (a >>> 1) & 2;
                a = a >>> d;
                b = (a >>> 1) & 1;
                b = ((e | i | g | d | b) + (a >>> b)) | 0;
                a = (9060 + ((b << 1) << 2)) | 0;
                d = (a + 8) | 0;
                g = c[d >> 2] | 0;
                i = (g + 8) | 0;
                e = c[i >> 2] | 0;
                do
                  if ((a | 0) != (e | 0)) {
                    if (e >>> 0 < (c[2259] | 0) >>> 0) $();
                    f = (e + 12) | 0;
                    if ((c[f >> 2] | 0) == (g | 0)) {
                      c[f >> 2] = a;
                      c[d >> 2] = e;
                      j = t;
                      break;
                    } else $();
                  } else {
                    j = t & ~(1 << b);
                    c[2255] = j;
                  }
                while (0);
                h = ((b << 3) - p) | 0;
                c[(g + 4) >> 2] = p | 3;
                e = (g + p) | 0;
                c[(e + 4) >> 2] = h | 1;
                c[(e + h) >> 2] = h;
                if (s | 0) {
                  f = c[2260] | 0;
                  b = s >>> 3;
                  d = (9060 + ((b << 1) << 2)) | 0;
                  b = 1 << b;
                  if (j & b) {
                    b = (d + 8) | 0;
                    a = c[b >> 2] | 0;
                    if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                    else {
                      k = a;
                      m = b;
                    }
                  } else {
                    c[2255] = j | b;
                    k = d;
                    m = (d + 8) | 0;
                  }
                  c[m >> 2] = f;
                  c[(k + 12) >> 2] = f;
                  c[(f + 8) >> 2] = k;
                  c[(f + 12) >> 2] = d;
                }
                c[2257] = h;
                c[2260] = e;
                J = i;
                l = K;
                return J | 0;
              }
              k = c[2256] | 0;
              if (k) {
                a = ((k & (0 - k)) + -1) | 0;
                I = (a >>> 12) & 16;
                a = a >>> I;
                H = (a >>> 5) & 8;
                a = a >>> H;
                J = (a >>> 2) & 4;
                a = a >>> J;
                d = (a >>> 1) & 2;
                a = a >>> d;
                b = (a >>> 1) & 1;
                b =
                  c[(9324 + (((H | I | J | d | b) + (a >>> b)) << 2)) >> 2] | 0;
                a = ((c[(b + 4) >> 2] & -8) - p) | 0;
                d =
                  c[
                    (b + 16 + ((((c[(b + 16) >> 2] | 0) == 0) & 1) << 2)) >> 2
                  ] | 0;
                if (!d) {
                  j = b;
                  h = a;
                } else {
                  do {
                    I = ((c[(d + 4) >> 2] & -8) - p) | 0;
                    J = I >>> 0 < a >>> 0;
                    a = J ? I : a;
                    b = J ? d : b;
                    d =
                      c[
                        (d + 16 + ((((c[(d + 16) >> 2] | 0) == 0) & 1) << 2)) >>
                          2
                      ] | 0;
                  } while ((d | 0) != 0);
                  j = b;
                  h = a;
                }
                f = c[2259] | 0;
                if (j >>> 0 < f >>> 0) $();
                i = (j + p) | 0;
                if (j >>> 0 >= i >>> 0) $();
                g = c[(j + 24) >> 2] | 0;
                d = c[(j + 12) >> 2] | 0;
                do
                  if ((d | 0) == (j | 0)) {
                    a = (j + 20) | 0;
                    b = c[a >> 2] | 0;
                    if (!b) {
                      a = (j + 16) | 0;
                      b = c[a >> 2] | 0;
                      if (!b) {
                        n = 0;
                        break;
                      }
                    }
                    while (1) {
                      d = (b + 20) | 0;
                      e = c[d >> 2] | 0;
                      if (e | 0) {
                        b = e;
                        a = d;
                        continue;
                      }
                      d = (b + 16) | 0;
                      e = c[d >> 2] | 0;
                      if (!e) break;
                      else {
                        b = e;
                        a = d;
                      }
                    }
                    if (a >>> 0 < f >>> 0) $();
                    else {
                      c[a >> 2] = 0;
                      n = b;
                      break;
                    }
                  } else {
                    e = c[(j + 8) >> 2] | 0;
                    if (e >>> 0 < f >>> 0) $();
                    b = (e + 12) | 0;
                    if ((c[b >> 2] | 0) != (j | 0)) $();
                    a = (d + 8) | 0;
                    if ((c[a >> 2] | 0) == (j | 0)) {
                      c[b >> 2] = d;
                      c[a >> 2] = e;
                      n = d;
                      break;
                    } else $();
                  }
                while (0);
                a: do
                  if (g | 0) {
                    b = c[(j + 28) >> 2] | 0;
                    a = (9324 + (b << 2)) | 0;
                    do
                      if ((j | 0) == (c[a >> 2] | 0)) {
                        c[a >> 2] = n;
                        if (!n) {
                          c[2256] = k & ~(1 << b);
                          break a;
                        }
                      } else if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                        c[
                          (g +
                            16 +
                            ((((c[(g + 16) >> 2] | 0) != (j | 0)) & 1) << 2)) >>
                            2
                        ] = n;
                        if (!n) break a;
                        else break;
                      } else $();
                    while (0);
                    a = c[2259] | 0;
                    if (n >>> 0 < a >>> 0) $();
                    c[(n + 24) >> 2] = g;
                    b = c[(j + 16) >> 2] | 0;
                    do
                      if (b | 0)
                        if (b >>> 0 < a >>> 0) $();
                        else {
                          c[(n + 16) >> 2] = b;
                          c[(b + 24) >> 2] = n;
                          break;
                        }
                    while (0);
                    b = c[(j + 20) >> 2] | 0;
                    if (b | 0)
                      if (b >>> 0 < (c[2259] | 0) >>> 0) $();
                      else {
                        c[(n + 20) >> 2] = b;
                        c[(b + 24) >> 2] = n;
                        break;
                      }
                  }
                while (0);
                if (h >>> 0 < 16) {
                  J = (h + p) | 0;
                  c[(j + 4) >> 2] = J | 3;
                  J = (j + J + 4) | 0;
                  c[J >> 2] = c[J >> 2] | 1;
                } else {
                  c[(j + 4) >> 2] = p | 3;
                  c[(i + 4) >> 2] = h | 1;
                  c[(i + h) >> 2] = h;
                  if (s | 0) {
                    e = c[2260] | 0;
                    b = s >>> 3;
                    d = (9060 + ((b << 1) << 2)) | 0;
                    b = 1 << b;
                    if (t & b) {
                      b = (d + 8) | 0;
                      a = c[b >> 2] | 0;
                      if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                      else {
                        q = a;
                        r = b;
                      }
                    } else {
                      c[2255] = t | b;
                      q = d;
                      r = (d + 8) | 0;
                    }
                    c[r >> 2] = e;
                    c[(q + 12) >> 2] = e;
                    c[(e + 8) >> 2] = q;
                    c[(e + 12) >> 2] = d;
                  }
                  c[2257] = h;
                  c[2260] = i;
                }
                J = (j + 8) | 0;
                l = K;
                return J | 0;
              }
            }
          } else if (a >>> 0 <= 4294967231) {
            a = (a + 11) | 0;
            p = a & -8;
            k = c[2256] | 0;
            if (k) {
              e = (0 - p) | 0;
              a = a >>> 8;
              if (a)
                if (p >>> 0 > 16777215) i = 31;
                else {
                  r = (((a + 1048320) | 0) >>> 16) & 8;
                  C = a << r;
                  q = (((C + 520192) | 0) >>> 16) & 4;
                  C = C << q;
                  i = (((C + 245760) | 0) >>> 16) & 2;
                  i = (14 - (q | r | i) + ((C << i) >>> 15)) | 0;
                  i = ((p >>> ((i + 7) | 0)) & 1) | (i << 1);
                }
              else i = 0;
              d = c[(9324 + (i << 2)) >> 2] | 0;
              b: do
                if (!d) {
                  d = 0;
                  a = 0;
                  C = 81;
                } else {
                  a = 0;
                  h = p << ((i | 0) == 31 ? 0 : (25 - (i >>> 1)) | 0);
                  g = 0;
                  while (1) {
                    f = ((c[(d + 4) >> 2] & -8) - p) | 0;
                    if (f >>> 0 < e >>> 0)
                      if (!f) {
                        a = d;
                        e = 0;
                        f = d;
                        C = 85;
                        break b;
                      } else {
                        a = d;
                        e = f;
                      }
                    f = c[(d + 20) >> 2] | 0;
                    d = c[(d + 16 + ((h >>> 31) << 2)) >> 2] | 0;
                    g = ((f | 0) == 0) | ((f | 0) == (d | 0)) ? g : f;
                    f = (d | 0) == 0;
                    if (f) {
                      d = g;
                      C = 81;
                      break;
                    } else h = h << ((f ^ 1) & 1);
                  }
                }
              while (0);
              if ((C | 0) == 81) {
                if (((d | 0) == 0) & ((a | 0) == 0)) {
                  a = 2 << i;
                  a = k & (a | (0 - a));
                  if (!a) break;
                  r = ((a & (0 - a)) + -1) | 0;
                  m = (r >>> 12) & 16;
                  r = r >>> m;
                  j = (r >>> 5) & 8;
                  r = r >>> j;
                  n = (r >>> 2) & 4;
                  r = r >>> n;
                  q = (r >>> 1) & 2;
                  r = r >>> q;
                  d = (r >>> 1) & 1;
                  a = 0;
                  d =
                    c[(9324 + (((j | m | n | q | d) + (r >>> d)) << 2)) >> 2] |
                    0;
                }
                if (!d) {
                  j = a;
                  i = e;
                } else {
                  f = d;
                  C = 85;
                }
              }
              if ((C | 0) == 85)
                while (1) {
                  C = 0;
                  d = ((c[(f + 4) >> 2] & -8) - p) | 0;
                  r = d >>> 0 < e >>> 0;
                  d = r ? d : e;
                  a = r ? f : a;
                  f =
                    c[
                      (f + 16 + ((((c[(f + 16) >> 2] | 0) == 0) & 1) << 2)) >> 2
                    ] | 0;
                  if (!f) {
                    j = a;
                    i = d;
                    break;
                  } else {
                    e = d;
                    C = 85;
                  }
                }
              if (
                (j | 0) != 0 ? i >>> 0 < (((c[2257] | 0) - p) | 0) >>> 0 : 0
              ) {
                f = c[2259] | 0;
                if (j >>> 0 < f >>> 0) $();
                h = (j + p) | 0;
                if (j >>> 0 >= h >>> 0) $();
                g = c[(j + 24) >> 2] | 0;
                d = c[(j + 12) >> 2] | 0;
                do
                  if ((d | 0) == (j | 0)) {
                    a = (j + 20) | 0;
                    b = c[a >> 2] | 0;
                    if (!b) {
                      a = (j + 16) | 0;
                      b = c[a >> 2] | 0;
                      if (!b) {
                        s = 0;
                        break;
                      }
                    }
                    while (1) {
                      d = (b + 20) | 0;
                      e = c[d >> 2] | 0;
                      if (e | 0) {
                        b = e;
                        a = d;
                        continue;
                      }
                      d = (b + 16) | 0;
                      e = c[d >> 2] | 0;
                      if (!e) break;
                      else {
                        b = e;
                        a = d;
                      }
                    }
                    if (a >>> 0 < f >>> 0) $();
                    else {
                      c[a >> 2] = 0;
                      s = b;
                      break;
                    }
                  } else {
                    e = c[(j + 8) >> 2] | 0;
                    if (e >>> 0 < f >>> 0) $();
                    b = (e + 12) | 0;
                    if ((c[b >> 2] | 0) != (j | 0)) $();
                    a = (d + 8) | 0;
                    if ((c[a >> 2] | 0) == (j | 0)) {
                      c[b >> 2] = d;
                      c[a >> 2] = e;
                      s = d;
                      break;
                    } else $();
                  }
                while (0);
                c: do
                  if (g) {
                    b = c[(j + 28) >> 2] | 0;
                    a = (9324 + (b << 2)) | 0;
                    do
                      if ((j | 0) == (c[a >> 2] | 0)) {
                        c[a >> 2] = s;
                        if (!s) {
                          t = k & ~(1 << b);
                          c[2256] = t;
                          break c;
                        }
                      } else if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                        c[
                          (g +
                            16 +
                            ((((c[(g + 16) >> 2] | 0) != (j | 0)) & 1) << 2)) >>
                            2
                        ] = s;
                        if (!s) {
                          t = k;
                          break c;
                        } else break;
                      } else $();
                    while (0);
                    a = c[2259] | 0;
                    if (s >>> 0 < a >>> 0) $();
                    c[(s + 24) >> 2] = g;
                    b = c[(j + 16) >> 2] | 0;
                    do
                      if (b | 0)
                        if (b >>> 0 < a >>> 0) $();
                        else {
                          c[(s + 16) >> 2] = b;
                          c[(b + 24) >> 2] = s;
                          break;
                        }
                    while (0);
                    b = c[(j + 20) >> 2] | 0;
                    if (b)
                      if (b >>> 0 < (c[2259] | 0) >>> 0) $();
                      else {
                        c[(s + 20) >> 2] = b;
                        c[(b + 24) >> 2] = s;
                        t = k;
                        break;
                      }
                    else t = k;
                  } else t = k;
                while (0);
                do
                  if (i >>> 0 >= 16) {
                    c[(j + 4) >> 2] = p | 3;
                    c[(h + 4) >> 2] = i | 1;
                    c[(h + i) >> 2] = i;
                    b = i >>> 3;
                    if (i >>> 0 < 256) {
                      d = (9060 + ((b << 1) << 2)) | 0;
                      a = c[2255] | 0;
                      b = 1 << b;
                      if (a & b) {
                        b = (d + 8) | 0;
                        a = c[b >> 2] | 0;
                        if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                        else {
                          x = a;
                          y = b;
                        }
                      } else {
                        c[2255] = a | b;
                        x = d;
                        y = (d + 8) | 0;
                      }
                      c[y >> 2] = h;
                      c[(x + 12) >> 2] = h;
                      c[(h + 8) >> 2] = x;
                      c[(h + 12) >> 2] = d;
                      break;
                    }
                    b = i >>> 8;
                    if (b)
                      if (i >>> 0 > 16777215) b = 31;
                      else {
                        I = (((b + 1048320) | 0) >>> 16) & 8;
                        J = b << I;
                        H = (((J + 520192) | 0) >>> 16) & 4;
                        J = J << H;
                        b = (((J + 245760) | 0) >>> 16) & 2;
                        b = (14 - (H | I | b) + ((J << b) >>> 15)) | 0;
                        b = ((i >>> ((b + 7) | 0)) & 1) | (b << 1);
                      }
                    else b = 0;
                    d = (9324 + (b << 2)) | 0;
                    c[(h + 28) >> 2] = b;
                    a = (h + 16) | 0;
                    c[(a + 4) >> 2] = 0;
                    c[a >> 2] = 0;
                    a = 1 << b;
                    if (!(t & a)) {
                      c[2256] = t | a;
                      c[d >> 2] = h;
                      c[(h + 24) >> 2] = d;
                      c[(h + 12) >> 2] = h;
                      c[(h + 8) >> 2] = h;
                      break;
                    }
                    a = i << ((b | 0) == 31 ? 0 : (25 - (b >>> 1)) | 0);
                    e = c[d >> 2] | 0;
                    while (1) {
                      if (((c[(e + 4) >> 2] & -8) | 0) == (i | 0)) {
                        C = 139;
                        break;
                      }
                      d = (e + 16 + ((a >>> 31) << 2)) | 0;
                      b = c[d >> 2] | 0;
                      if (!b) {
                        C = 136;
                        break;
                      } else {
                        a = a << 1;
                        e = b;
                      }
                    }
                    if ((C | 0) == 136)
                      if (d >>> 0 < (c[2259] | 0) >>> 0) $();
                      else {
                        c[d >> 2] = h;
                        c[(h + 24) >> 2] = e;
                        c[(h + 12) >> 2] = h;
                        c[(h + 8) >> 2] = h;
                        break;
                      }
                    else if ((C | 0) == 139) {
                      b = (e + 8) | 0;
                      a = c[b >> 2] | 0;
                      J = c[2259] | 0;
                      if ((a >>> 0 >= J >>> 0) & (e >>> 0 >= J >>> 0)) {
                        c[(a + 12) >> 2] = h;
                        c[b >> 2] = h;
                        c[(h + 8) >> 2] = a;
                        c[(h + 12) >> 2] = e;
                        c[(h + 24) >> 2] = 0;
                        break;
                      } else $();
                    }
                  } else {
                    J = (i + p) | 0;
                    c[(j + 4) >> 2] = J | 3;
                    J = (j + J + 4) | 0;
                    c[J >> 2] = c[J >> 2] | 1;
                  }
                while (0);
                J = (j + 8) | 0;
                l = K;
                return J | 0;
              }
            }
          } else p = -1;
        while (0);
        d = c[2257] | 0;
        if (d >>> 0 >= p >>> 0) {
          b = (d - p) | 0;
          a = c[2260] | 0;
          if (b >>> 0 > 15) {
            J = (a + p) | 0;
            c[2260] = J;
            c[2257] = b;
            c[(J + 4) >> 2] = b | 1;
            c[(J + b) >> 2] = b;
            c[(a + 4) >> 2] = p | 3;
          } else {
            c[2257] = 0;
            c[2260] = 0;
            c[(a + 4) >> 2] = d | 3;
            J = (a + d + 4) | 0;
            c[J >> 2] = c[J >> 2] | 1;
          }
          J = (a + 8) | 0;
          l = K;
          return J | 0;
        }
        h = c[2258] | 0;
        if (h >>> 0 > p >>> 0) {
          H = (h - p) | 0;
          c[2258] = H;
          J = c[2261] | 0;
          I = (J + p) | 0;
          c[2261] = I;
          c[(I + 4) >> 2] = H | 1;
          c[(J + 4) >> 2] = p | 3;
          J = (J + 8) | 0;
          l = K;
          return J | 0;
        }
        if (!(c[2373] | 0)) {
          c[2375] = 4096;
          c[2374] = 4096;
          c[2376] = -1;
          c[2377] = -1;
          c[2378] = 0;
          c[2366] = 0;
          a = (o & -16) ^ 1431655768;
          c[o >> 2] = a;
          c[2373] = a;
          a = 4096;
        } else a = c[2375] | 0;
        i = (p + 48) | 0;
        j = (p + 47) | 0;
        g = (a + j) | 0;
        f = (0 - a) | 0;
        k = g & f;
        if (k >>> 0 <= p >>> 0) {
          J = 0;
          l = K;
          return J | 0;
        }
        a = c[2365] | 0;
        if (
          a | 0
            ? ((x = c[2363] | 0),
              (y = (x + k) | 0),
              (y >>> 0 <= x >>> 0) | (y >>> 0 > a >>> 0))
            : 0
        ) {
          J = 0;
          l = K;
          return J | 0;
        }
        d: do
          if (!(c[2366] & 4)) {
            d = c[2261] | 0;
            e: do
              if (d) {
                e = 9468;
                while (1) {
                  a = c[e >> 2] | 0;
                  if (
                    a >>> 0 <= d >>> 0
                      ? ((w = (e + 4) | 0),
                        ((a + (c[w >> 2] | 0)) | 0) >>> 0 > d >>> 0)
                      : 0
                  )
                    break;
                  a = c[(e + 8) >> 2] | 0;
                  if (!a) {
                    C = 163;
                    break e;
                  } else e = a;
                }
                b = (g - h) & f;
                if (b >>> 0 < 2147483647) {
                  a = sb(b | 0) | 0;
                  if ((a | 0) == (((c[e >> 2] | 0) + (c[w >> 2] | 0)) | 0)) {
                    if ((a | 0) != (-1 | 0)) {
                      h = b;
                      g = a;
                      C = 180;
                      break d;
                    }
                  } else {
                    e = a;
                    C = 171;
                  }
                } else b = 0;
              } else C = 163;
            while (0);
            do
              if ((C | 0) == 163) {
                d = sb(0) | 0;
                if (
                  (d | 0) != (-1 | 0)
                    ? ((b = d),
                      (u = c[2374] | 0),
                      (v = (u + -1) | 0),
                      (b =
                        ((((v & b) | 0) == 0
                          ? 0
                          : (((v + b) & (0 - u)) - b) | 0) +
                          k) |
                        0),
                      (u = c[2363] | 0),
                      (v = (b + u) | 0),
                      (b >>> 0 > p >>> 0) & (b >>> 0 < 2147483647))
                    : 0
                ) {
                  y = c[2365] | 0;
                  if (y | 0 ? (v >>> 0 <= u >>> 0) | (v >>> 0 > y >>> 0) : 0) {
                    b = 0;
                    break;
                  }
                  a = sb(b | 0) | 0;
                  if ((a | 0) == (d | 0)) {
                    h = b;
                    g = d;
                    C = 180;
                    break d;
                  } else {
                    e = a;
                    C = 171;
                  }
                } else b = 0;
              }
            while (0);
            do
              if ((C | 0) == 171) {
                d = (0 - b) | 0;
                if (
                  !(
                    (i >>> 0 > b >>> 0) &
                    ((b >>> 0 < 2147483647) & ((e | 0) != (-1 | 0)))
                  )
                )
                  if ((e | 0) == (-1 | 0)) {
                    b = 0;
                    break;
                  } else {
                    h = b;
                    g = e;
                    C = 180;
                    break d;
                  }
                a = c[2375] | 0;
                a = (j - b + a) & (0 - a);
                if (a >>> 0 >= 2147483647) {
                  h = b;
                  g = e;
                  C = 180;
                  break d;
                }
                if ((sb(a | 0) | 0) == (-1 | 0)) {
                  sb(d | 0) | 0;
                  b = 0;
                  break;
                } else {
                  h = (a + b) | 0;
                  g = e;
                  C = 180;
                  break d;
                }
              }
            while (0);
            c[2366] = c[2366] | 4;
            C = 178;
          } else {
            b = 0;
            C = 178;
          }
        while (0);
        if (
          ((C | 0) == 178
          ? k >>> 0 < 2147483647
          : 0)
            ? ((B = sb(k | 0) | 0),
              (y = sb(0) | 0),
              (z = (y - B) | 0),
              (A = z >>> 0 > ((p + 40) | 0) >>> 0),
              !(
                ((B | 0) == (-1 | 0)) |
                (A ^ 1) |
                (((B >>> 0 < y >>> 0) &
                  (((B | 0) != (-1 | 0)) & ((y | 0) != (-1 | 0)))) ^
                  1)
              ))
            : 0
        ) {
          h = A ? z : b;
          g = B;
          C = 180;
        }
        if ((C | 0) == 180) {
          b = ((c[2363] | 0) + h) | 0;
          c[2363] = b;
          if (b >>> 0 > (c[2364] | 0) >>> 0) c[2364] = b;
          k = c[2261] | 0;
          do
            if (k) {
              b = 9468;
              while (1) {
                a = c[b >> 2] | 0;
                d = (b + 4) | 0;
                e = c[d >> 2] | 0;
                if ((g | 0) == ((a + e) | 0)) {
                  C = 190;
                  break;
                }
                f = c[(b + 8) >> 2] | 0;
                if (!f) break;
                else b = f;
              }
              if (
                ((C | 0) == 190
                ? ((c[(b + 12) >> 2] & 8) | 0) == 0
                : 0)
                  ? (k >>> 0 < g >>> 0) & (k >>> 0 >= a >>> 0)
                  : 0
              ) {
                c[d >> 2] = e + h;
                J = (k + 8) | 0;
                J = ((J & 7) | 0) == 0 ? 0 : (0 - J) & 7;
                I = (k + J) | 0;
                J = ((c[2258] | 0) + (h - J)) | 0;
                c[2261] = I;
                c[2258] = J;
                c[(I + 4) >> 2] = J | 1;
                c[(I + J + 4) >> 2] = 40;
                c[2262] = c[2377];
                break;
              }
              b = c[2259] | 0;
              if (g >>> 0 < b >>> 0) {
                c[2259] = g;
                i = g;
              } else i = b;
              d = (g + h) | 0;
              b = 9468;
              while (1) {
                if ((c[b >> 2] | 0) == (d | 0)) {
                  C = 198;
                  break;
                }
                a = c[(b + 8) >> 2] | 0;
                if (!a) break;
                else b = a;
              }
              if ((C | 0) == 198 ? ((c[(b + 12) >> 2] & 8) | 0) == 0 : 0) {
                c[b >> 2] = g;
                n = (b + 4) | 0;
                c[n >> 2] = (c[n >> 2] | 0) + h;
                n = (g + 8) | 0;
                n = (g + (((n & 7) | 0) == 0 ? 0 : (0 - n) & 7)) | 0;
                b = (d + 8) | 0;
                b = (d + (((b & 7) | 0) == 0 ? 0 : (0 - b) & 7)) | 0;
                m = (n + p) | 0;
                j = (b - n - p) | 0;
                c[(n + 4) >> 2] = p | 3;
                do
                  if ((b | 0) != (k | 0)) {
                    if ((b | 0) == (c[2260] | 0)) {
                      J = ((c[2257] | 0) + j) | 0;
                      c[2257] = J;
                      c[2260] = m;
                      c[(m + 4) >> 2] = J | 1;
                      c[(m + J) >> 2] = J;
                      break;
                    }
                    a = c[(b + 4) >> 2] | 0;
                    if (((a & 3) | 0) == 1) {
                      h = a & -8;
                      f = a >>> 3;
                      f: do
                        if (a >>> 0 >= 256) {
                          g = c[(b + 24) >> 2] | 0;
                          e = c[(b + 12) >> 2] | 0;
                          do
                            if ((e | 0) == (b | 0)) {
                              e = (b + 16) | 0;
                              d = (e + 4) | 0;
                              a = c[d >> 2] | 0;
                              if (!a) {
                                a = c[e >> 2] | 0;
                                if (!a) {
                                  H = 0;
                                  break;
                                } else d = e;
                              }
                              while (1) {
                                e = (a + 20) | 0;
                                f = c[e >> 2] | 0;
                                if (f | 0) {
                                  a = f;
                                  d = e;
                                  continue;
                                }
                                e = (a + 16) | 0;
                                f = c[e >> 2] | 0;
                                if (!f) break;
                                else {
                                  a = f;
                                  d = e;
                                }
                              }
                              if (d >>> 0 < i >>> 0) $();
                              else {
                                c[d >> 2] = 0;
                                H = a;
                                break;
                              }
                            } else {
                              f = c[(b + 8) >> 2] | 0;
                              if (f >>> 0 < i >>> 0) $();
                              a = (f + 12) | 0;
                              if ((c[a >> 2] | 0) != (b | 0)) $();
                              d = (e + 8) | 0;
                              if ((c[d >> 2] | 0) == (b | 0)) {
                                c[a >> 2] = e;
                                c[d >> 2] = f;
                                H = e;
                                break;
                              } else $();
                            }
                          while (0);
                          if (!g) break;
                          a = c[(b + 28) >> 2] | 0;
                          d = (9324 + (a << 2)) | 0;
                          do
                            if ((b | 0) != (c[d >> 2] | 0))
                              if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                                c[
                                  (g +
                                    16 +
                                    ((((c[(g + 16) >> 2] | 0) != (b | 0)) &
                                      1) <<
                                      2)) >>
                                    2
                                ] = H;
                                if (!H) break f;
                                else break;
                              } else $();
                            else {
                              c[d >> 2] = H;
                              if (H | 0) break;
                              c[2256] = c[2256] & ~(1 << a);
                              break f;
                            }
                          while (0);
                          e = c[2259] | 0;
                          if (H >>> 0 < e >>> 0) $();
                          c[(H + 24) >> 2] = g;
                          a = (b + 16) | 0;
                          d = c[a >> 2] | 0;
                          do
                            if (d | 0)
                              if (d >>> 0 < e >>> 0) $();
                              else {
                                c[(H + 16) >> 2] = d;
                                c[(d + 24) >> 2] = H;
                                break;
                              }
                          while (0);
                          a = c[(a + 4) >> 2] | 0;
                          if (!a) break;
                          if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                          else {
                            c[(H + 20) >> 2] = a;
                            c[(a + 24) >> 2] = H;
                            break;
                          }
                        } else {
                          d = c[(b + 8) >> 2] | 0;
                          e = c[(b + 12) >> 2] | 0;
                          a = (9060 + ((f << 1) << 2)) | 0;
                          do
                            if ((d | 0) != (a | 0)) {
                              if (d >>> 0 < i >>> 0) $();
                              if ((c[(d + 12) >> 2] | 0) == (b | 0)) break;
                              $();
                            }
                          while (0);
                          if ((e | 0) == (d | 0)) {
                            c[2255] = c[2255] & ~(1 << f);
                            break;
                          }
                          do
                            if ((e | 0) == (a | 0)) E = (e + 8) | 0;
                            else {
                              if (e >>> 0 < i >>> 0) $();
                              a = (e + 8) | 0;
                              if ((c[a >> 2] | 0) == (b | 0)) {
                                E = a;
                                break;
                              }
                              $();
                            }
                          while (0);
                          c[(d + 12) >> 2] = e;
                          c[E >> 2] = d;
                        }
                      while (0);
                      b = (b + h) | 0;
                      f = (h + j) | 0;
                    } else f = j;
                    b = (b + 4) | 0;
                    c[b >> 2] = c[b >> 2] & -2;
                    c[(m + 4) >> 2] = f | 1;
                    c[(m + f) >> 2] = f;
                    b = f >>> 3;
                    if (f >>> 0 < 256) {
                      d = (9060 + ((b << 1) << 2)) | 0;
                      a = c[2255] | 0;
                      b = 1 << b;
                      do
                        if (!(a & b)) {
                          c[2255] = a | b;
                          I = d;
                          J = (d + 8) | 0;
                        } else {
                          b = (d + 8) | 0;
                          a = c[b >> 2] | 0;
                          if (a >>> 0 >= (c[2259] | 0) >>> 0) {
                            I = a;
                            J = b;
                            break;
                          }
                          $();
                        }
                      while (0);
                      c[J >> 2] = m;
                      c[(I + 12) >> 2] = m;
                      c[(m + 8) >> 2] = I;
                      c[(m + 12) >> 2] = d;
                      break;
                    }
                    b = f >>> 8;
                    do
                      if (!b) b = 0;
                      else {
                        if (f >>> 0 > 16777215) {
                          b = 31;
                          break;
                        }
                        I = (((b + 1048320) | 0) >>> 16) & 8;
                        J = b << I;
                        H = (((J + 520192) | 0) >>> 16) & 4;
                        J = J << H;
                        b = (((J + 245760) | 0) >>> 16) & 2;
                        b = (14 - (H | I | b) + ((J << b) >>> 15)) | 0;
                        b = ((f >>> ((b + 7) | 0)) & 1) | (b << 1);
                      }
                    while (0);
                    e = (9324 + (b << 2)) | 0;
                    c[(m + 28) >> 2] = b;
                    a = (m + 16) | 0;
                    c[(a + 4) >> 2] = 0;
                    c[a >> 2] = 0;
                    a = c[2256] | 0;
                    d = 1 << b;
                    if (!(a & d)) {
                      c[2256] = a | d;
                      c[e >> 2] = m;
                      c[(m + 24) >> 2] = e;
                      c[(m + 12) >> 2] = m;
                      c[(m + 8) >> 2] = m;
                      break;
                    }
                    a = f << ((b | 0) == 31 ? 0 : (25 - (b >>> 1)) | 0);
                    e = c[e >> 2] | 0;
                    while (1) {
                      if (((c[(e + 4) >> 2] & -8) | 0) == (f | 0)) {
                        C = 265;
                        break;
                      }
                      d = (e + 16 + ((a >>> 31) << 2)) | 0;
                      b = c[d >> 2] | 0;
                      if (!b) {
                        C = 262;
                        break;
                      } else {
                        a = a << 1;
                        e = b;
                      }
                    }
                    if ((C | 0) == 262)
                      if (d >>> 0 < (c[2259] | 0) >>> 0) $();
                      else {
                        c[d >> 2] = m;
                        c[(m + 24) >> 2] = e;
                        c[(m + 12) >> 2] = m;
                        c[(m + 8) >> 2] = m;
                        break;
                      }
                    else if ((C | 0) == 265) {
                      b = (e + 8) | 0;
                      a = c[b >> 2] | 0;
                      J = c[2259] | 0;
                      if ((a >>> 0 >= J >>> 0) & (e >>> 0 >= J >>> 0)) {
                        c[(a + 12) >> 2] = m;
                        c[b >> 2] = m;
                        c[(m + 8) >> 2] = a;
                        c[(m + 12) >> 2] = e;
                        c[(m + 24) >> 2] = 0;
                        break;
                      } else $();
                    }
                  } else {
                    J = ((c[2258] | 0) + j) | 0;
                    c[2258] = J;
                    c[2261] = m;
                    c[(m + 4) >> 2] = J | 1;
                  }
                while (0);
                J = (n + 8) | 0;
                l = K;
                return J | 0;
              }
              b = 9468;
              while (1) {
                a = c[b >> 2] | 0;
                if (
                  a >>> 0 <= k >>> 0
                    ? ((D = (a + (c[(b + 4) >> 2] | 0)) | 0), D >>> 0 > k >>> 0)
                    : 0
                )
                  break;
                b = c[(b + 8) >> 2] | 0;
              }
              f = (D + -47) | 0;
              a = (f + 8) | 0;
              a = (f + (((a & 7) | 0) == 0 ? 0 : (0 - a) & 7)) | 0;
              f = (k + 16) | 0;
              a = a >>> 0 < f >>> 0 ? k : a;
              b = (a + 8) | 0;
              d = (g + 8) | 0;
              d = ((d & 7) | 0) == 0 ? 0 : (0 - d) & 7;
              J = (g + d) | 0;
              d = (h + -40 - d) | 0;
              c[2261] = J;
              c[2258] = d;
              c[(J + 4) >> 2] = d | 1;
              c[(J + d + 4) >> 2] = 40;
              c[2262] = c[2377];
              d = (a + 4) | 0;
              c[d >> 2] = 27;
              c[b >> 2] = c[2367];
              c[(b + 4) >> 2] = c[2368];
              c[(b + 8) >> 2] = c[2369];
              c[(b + 12) >> 2] = c[2370];
              c[2367] = g;
              c[2368] = h;
              c[2370] = 0;
              c[2369] = b;
              b = (a + 24) | 0;
              do {
                J = b;
                b = (b + 4) | 0;
                c[b >> 2] = 7;
              } while (((J + 8) | 0) >>> 0 < D >>> 0);
              if ((a | 0) != (k | 0)) {
                g = (a - k) | 0;
                c[d >> 2] = c[d >> 2] & -2;
                c[(k + 4) >> 2] = g | 1;
                c[a >> 2] = g;
                b = g >>> 3;
                if (g >>> 0 < 256) {
                  d = (9060 + ((b << 1) << 2)) | 0;
                  a = c[2255] | 0;
                  b = 1 << b;
                  if (a & b) {
                    b = (d + 8) | 0;
                    a = c[b >> 2] | 0;
                    if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                    else {
                      F = a;
                      G = b;
                    }
                  } else {
                    c[2255] = a | b;
                    F = d;
                    G = (d + 8) | 0;
                  }
                  c[G >> 2] = k;
                  c[(F + 12) >> 2] = k;
                  c[(k + 8) >> 2] = F;
                  c[(k + 12) >> 2] = d;
                  break;
                }
                b = g >>> 8;
                if (b)
                  if (g >>> 0 > 16777215) d = 31;
                  else {
                    I = (((b + 1048320) | 0) >>> 16) & 8;
                    J = b << I;
                    H = (((J + 520192) | 0) >>> 16) & 4;
                    J = J << H;
                    d = (((J + 245760) | 0) >>> 16) & 2;
                    d = (14 - (H | I | d) + ((J << d) >>> 15)) | 0;
                    d = ((g >>> ((d + 7) | 0)) & 1) | (d << 1);
                  }
                else d = 0;
                e = (9324 + (d << 2)) | 0;
                c[(k + 28) >> 2] = d;
                c[(k + 20) >> 2] = 0;
                c[f >> 2] = 0;
                b = c[2256] | 0;
                a = 1 << d;
                if (!(b & a)) {
                  c[2256] = b | a;
                  c[e >> 2] = k;
                  c[(k + 24) >> 2] = e;
                  c[(k + 12) >> 2] = k;
                  c[(k + 8) >> 2] = k;
                  break;
                }
                a = g << ((d | 0) == 31 ? 0 : (25 - (d >>> 1)) | 0);
                e = c[e >> 2] | 0;
                while (1) {
                  if (((c[(e + 4) >> 2] & -8) | 0) == (g | 0)) {
                    C = 292;
                    break;
                  }
                  d = (e + 16 + ((a >>> 31) << 2)) | 0;
                  b = c[d >> 2] | 0;
                  if (!b) {
                    C = 289;
                    break;
                  } else {
                    a = a << 1;
                    e = b;
                  }
                }
                if ((C | 0) == 289)
                  if (d >>> 0 < (c[2259] | 0) >>> 0) $();
                  else {
                    c[d >> 2] = k;
                    c[(k + 24) >> 2] = e;
                    c[(k + 12) >> 2] = k;
                    c[(k + 8) >> 2] = k;
                    break;
                  }
                else if ((C | 0) == 292) {
                  b = (e + 8) | 0;
                  a = c[b >> 2] | 0;
                  J = c[2259] | 0;
                  if ((a >>> 0 >= J >>> 0) & (e >>> 0 >= J >>> 0)) {
                    c[(a + 12) >> 2] = k;
                    c[b >> 2] = k;
                    c[(k + 8) >> 2] = a;
                    c[(k + 12) >> 2] = e;
                    c[(k + 24) >> 2] = 0;
                    break;
                  } else $();
                }
              }
            } else {
              J = c[2259] | 0;
              if (((J | 0) == 0) | (g >>> 0 < J >>> 0)) c[2259] = g;
              c[2367] = g;
              c[2368] = h;
              c[2370] = 0;
              c[2264] = c[2373];
              c[2263] = -1;
              b = 0;
              do {
                J = (9060 + ((b << 1) << 2)) | 0;
                c[(J + 12) >> 2] = J;
                c[(J + 8) >> 2] = J;
                b = (b + 1) | 0;
              } while ((b | 0) != 32);
              J = (g + 8) | 0;
              J = ((J & 7) | 0) == 0 ? 0 : (0 - J) & 7;
              I = (g + J) | 0;
              J = (h + -40 - J) | 0;
              c[2261] = I;
              c[2258] = J;
              c[(I + 4) >> 2] = J | 1;
              c[(I + J + 4) >> 2] = 40;
              c[2262] = c[2377];
            }
          while (0);
          b = c[2258] | 0;
          if (b >>> 0 > p >>> 0) {
            H = (b - p) | 0;
            c[2258] = H;
            J = c[2261] | 0;
            I = (J + p) | 0;
            c[2261] = I;
            c[(I + 4) >> 2] = H | 1;
            c[(J + 4) >> 2] = p | 3;
            J = (J + 8) | 0;
            l = K;
            return J | 0;
          }
        }
        c[(Wa() | 0) >> 2] = 12;
        J = 0;
        l = K;
        return J | 0;
      }
      function hb(a) {
        a = a | 0;
        var b = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0;
        if (!a) return;
        d = (a + -8) | 0;
        h = c[2259] | 0;
        if (d >>> 0 < h >>> 0) $();
        a = c[(a + -4) >> 2] | 0;
        b = a & 3;
        if ((b | 0) == 1) $();
        e = a & -8;
        o = (d + e) | 0;
        a: do
          if (!(a & 1)) {
            a = c[d >> 2] | 0;
            if (!b) return;
            k = (d + (0 - a)) | 0;
            j = (a + e) | 0;
            if (k >>> 0 < h >>> 0) $();
            if ((k | 0) == (c[2260] | 0)) {
              a = (o + 4) | 0;
              b = c[a >> 2] | 0;
              if (((b & 3) | 0) != 3) {
                r = k;
                f = j;
                m = k;
                break;
              }
              c[2257] = j;
              c[a >> 2] = b & -2;
              c[(k + 4) >> 2] = j | 1;
              c[(k + j) >> 2] = j;
              return;
            }
            e = a >>> 3;
            if (a >>> 0 < 256) {
              b = c[(k + 8) >> 2] | 0;
              d = c[(k + 12) >> 2] | 0;
              a = (9060 + ((e << 1) << 2)) | 0;
              if ((b | 0) != (a | 0)) {
                if (b >>> 0 < h >>> 0) $();
                if ((c[(b + 12) >> 2] | 0) != (k | 0)) $();
              }
              if ((d | 0) == (b | 0)) {
                c[2255] = c[2255] & ~(1 << e);
                r = k;
                f = j;
                m = k;
                break;
              }
              if ((d | 0) != (a | 0)) {
                if (d >>> 0 < h >>> 0) $();
                a = (d + 8) | 0;
                if ((c[a >> 2] | 0) == (k | 0)) g = a;
                else $();
              } else g = (d + 8) | 0;
              c[(b + 12) >> 2] = d;
              c[g >> 2] = b;
              r = k;
              f = j;
              m = k;
              break;
            }
            g = c[(k + 24) >> 2] | 0;
            d = c[(k + 12) >> 2] | 0;
            do
              if ((d | 0) == (k | 0)) {
                d = (k + 16) | 0;
                b = (d + 4) | 0;
                a = c[b >> 2] | 0;
                if (!a) {
                  a = c[d >> 2] | 0;
                  if (!a) {
                    i = 0;
                    break;
                  } else b = d;
                }
                while (1) {
                  d = (a + 20) | 0;
                  e = c[d >> 2] | 0;
                  if (e | 0) {
                    a = e;
                    b = d;
                    continue;
                  }
                  d = (a + 16) | 0;
                  e = c[d >> 2] | 0;
                  if (!e) break;
                  else {
                    a = e;
                    b = d;
                  }
                }
                if (b >>> 0 < h >>> 0) $();
                else {
                  c[b >> 2] = 0;
                  i = a;
                  break;
                }
              } else {
                e = c[(k + 8) >> 2] | 0;
                if (e >>> 0 < h >>> 0) $();
                a = (e + 12) | 0;
                if ((c[a >> 2] | 0) != (k | 0)) $();
                b = (d + 8) | 0;
                if ((c[b >> 2] | 0) == (k | 0)) {
                  c[a >> 2] = d;
                  c[b >> 2] = e;
                  i = d;
                  break;
                } else $();
              }
            while (0);
            if (g) {
              a = c[(k + 28) >> 2] | 0;
              b = (9324 + (a << 2)) | 0;
              do
                if ((k | 0) == (c[b >> 2] | 0)) {
                  c[b >> 2] = i;
                  if (!i) {
                    c[2256] = c[2256] & ~(1 << a);
                    r = k;
                    f = j;
                    m = k;
                    break a;
                  }
                } else if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                  c[
                    (g +
                      16 +
                      ((((c[(g + 16) >> 2] | 0) != (k | 0)) & 1) << 2)) >>
                      2
                  ] = i;
                  if (!i) {
                    r = k;
                    f = j;
                    m = k;
                    break a;
                  } else break;
                } else $();
              while (0);
              d = c[2259] | 0;
              if (i >>> 0 < d >>> 0) $();
              c[(i + 24) >> 2] = g;
              a = (k + 16) | 0;
              b = c[a >> 2] | 0;
              do
                if (b | 0)
                  if (b >>> 0 < d >>> 0) $();
                  else {
                    c[(i + 16) >> 2] = b;
                    c[(b + 24) >> 2] = i;
                    break;
                  }
              while (0);
              a = c[(a + 4) >> 2] | 0;
              if (a)
                if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                else {
                  c[(i + 20) >> 2] = a;
                  c[(a + 24) >> 2] = i;
                  r = k;
                  f = j;
                  m = k;
                  break;
                }
              else {
                r = k;
                f = j;
                m = k;
              }
            } else {
              r = k;
              f = j;
              m = k;
            }
          } else {
            r = d;
            f = e;
            m = d;
          }
        while (0);
        if (m >>> 0 >= o >>> 0) $();
        a = (o + 4) | 0;
        b = c[a >> 2] | 0;
        if (!(b & 1)) $();
        if (!(b & 2)) {
          a = c[2260] | 0;
          if ((o | 0) == (c[2261] | 0)) {
            q = ((c[2258] | 0) + f) | 0;
            c[2258] = q;
            c[2261] = r;
            c[(r + 4) >> 2] = q | 1;
            if ((r | 0) != (a | 0)) return;
            c[2260] = 0;
            c[2257] = 0;
            return;
          }
          if ((o | 0) == (a | 0)) {
            q = ((c[2257] | 0) + f) | 0;
            c[2257] = q;
            c[2260] = m;
            c[(r + 4) >> 2] = q | 1;
            c[(m + q) >> 2] = q;
            return;
          }
          f = ((b & -8) + f) | 0;
          e = b >>> 3;
          b: do
            if (b >>> 0 >= 256) {
              g = c[(o + 24) >> 2] | 0;
              a = c[(o + 12) >> 2] | 0;
              do
                if ((a | 0) == (o | 0)) {
                  d = (o + 16) | 0;
                  b = (d + 4) | 0;
                  a = c[b >> 2] | 0;
                  if (!a) {
                    a = c[d >> 2] | 0;
                    if (!a) {
                      n = 0;
                      break;
                    } else b = d;
                  }
                  while (1) {
                    d = (a + 20) | 0;
                    e = c[d >> 2] | 0;
                    if (e | 0) {
                      a = e;
                      b = d;
                      continue;
                    }
                    d = (a + 16) | 0;
                    e = c[d >> 2] | 0;
                    if (!e) break;
                    else {
                      a = e;
                      b = d;
                    }
                  }
                  if (b >>> 0 < (c[2259] | 0) >>> 0) $();
                  else {
                    c[b >> 2] = 0;
                    n = a;
                    break;
                  }
                } else {
                  b = c[(o + 8) >> 2] | 0;
                  if (b >>> 0 < (c[2259] | 0) >>> 0) $();
                  d = (b + 12) | 0;
                  if ((c[d >> 2] | 0) != (o | 0)) $();
                  e = (a + 8) | 0;
                  if ((c[e >> 2] | 0) == (o | 0)) {
                    c[d >> 2] = a;
                    c[e >> 2] = b;
                    n = a;
                    break;
                  } else $();
                }
              while (0);
              if (g | 0) {
                a = c[(o + 28) >> 2] | 0;
                b = (9324 + (a << 2)) | 0;
                do
                  if ((o | 0) == (c[b >> 2] | 0)) {
                    c[b >> 2] = n;
                    if (!n) {
                      c[2256] = c[2256] & ~(1 << a);
                      break b;
                    }
                  } else if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                    c[
                      (g +
                        16 +
                        ((((c[(g + 16) >> 2] | 0) != (o | 0)) & 1) << 2)) >>
                        2
                    ] = n;
                    if (!n) break b;
                    else break;
                  } else $();
                while (0);
                d = c[2259] | 0;
                if (n >>> 0 < d >>> 0) $();
                c[(n + 24) >> 2] = g;
                a = (o + 16) | 0;
                b = c[a >> 2] | 0;
                do
                  if (b | 0)
                    if (b >>> 0 < d >>> 0) $();
                    else {
                      c[(n + 16) >> 2] = b;
                      c[(b + 24) >> 2] = n;
                      break;
                    }
                while (0);
                a = c[(a + 4) >> 2] | 0;
                if (a | 0)
                  if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                  else {
                    c[(n + 20) >> 2] = a;
                    c[(a + 24) >> 2] = n;
                    break;
                  }
              }
            } else {
              b = c[(o + 8) >> 2] | 0;
              d = c[(o + 12) >> 2] | 0;
              a = (9060 + ((e << 1) << 2)) | 0;
              if ((b | 0) != (a | 0)) {
                if (b >>> 0 < (c[2259] | 0) >>> 0) $();
                if ((c[(b + 12) >> 2] | 0) != (o | 0)) $();
              }
              if ((d | 0) == (b | 0)) {
                c[2255] = c[2255] & ~(1 << e);
                break;
              }
              if ((d | 0) != (a | 0)) {
                if (d >>> 0 < (c[2259] | 0) >>> 0) $();
                a = (d + 8) | 0;
                if ((c[a >> 2] | 0) == (o | 0)) l = a;
                else $();
              } else l = (d + 8) | 0;
              c[(b + 12) >> 2] = d;
              c[l >> 2] = b;
            }
          while (0);
          c[(r + 4) >> 2] = f | 1;
          c[(m + f) >> 2] = f;
          if ((r | 0) == (c[2260] | 0)) {
            c[2257] = f;
            return;
          }
        } else {
          c[a >> 2] = b & -2;
          c[(r + 4) >> 2] = f | 1;
          c[(m + f) >> 2] = f;
        }
        a = f >>> 3;
        if (f >>> 0 < 256) {
          d = (9060 + ((a << 1) << 2)) | 0;
          b = c[2255] | 0;
          a = 1 << a;
          if (b & a) {
            a = (d + 8) | 0;
            b = c[a >> 2] | 0;
            if (b >>> 0 < (c[2259] | 0) >>> 0) $();
            else {
              p = b;
              q = a;
            }
          } else {
            c[2255] = b | a;
            p = d;
            q = (d + 8) | 0;
          }
          c[q >> 2] = r;
          c[(p + 12) >> 2] = r;
          c[(r + 8) >> 2] = p;
          c[(r + 12) >> 2] = d;
          return;
        }
        a = f >>> 8;
        if (a)
          if (f >>> 0 > 16777215) a = 31;
          else {
            p = (((a + 1048320) | 0) >>> 16) & 8;
            q = a << p;
            o = (((q + 520192) | 0) >>> 16) & 4;
            q = q << o;
            a = (((q + 245760) | 0) >>> 16) & 2;
            a = (14 - (o | p | a) + ((q << a) >>> 15)) | 0;
            a = ((f >>> ((a + 7) | 0)) & 1) | (a << 1);
          }
        else a = 0;
        e = (9324 + (a << 2)) | 0;
        c[(r + 28) >> 2] = a;
        c[(r + 20) >> 2] = 0;
        c[(r + 16) >> 2] = 0;
        b = c[2256] | 0;
        d = 1 << a;
        do
          if (b & d) {
            b = f << ((a | 0) == 31 ? 0 : (25 - (a >>> 1)) | 0);
            e = c[e >> 2] | 0;
            while (1) {
              if (((c[(e + 4) >> 2] & -8) | 0) == (f | 0)) {
                a = 124;
                break;
              }
              d = (e + 16 + ((b >>> 31) << 2)) | 0;
              a = c[d >> 2] | 0;
              if (!a) {
                a = 121;
                break;
              } else {
                b = b << 1;
                e = a;
              }
            }
            if ((a | 0) == 121)
              if (d >>> 0 < (c[2259] | 0) >>> 0) $();
              else {
                c[d >> 2] = r;
                c[(r + 24) >> 2] = e;
                c[(r + 12) >> 2] = r;
                c[(r + 8) >> 2] = r;
                break;
              }
            else if ((a | 0) == 124) {
              a = (e + 8) | 0;
              b = c[a >> 2] | 0;
              q = c[2259] | 0;
              if ((b >>> 0 >= q >>> 0) & (e >>> 0 >= q >>> 0)) {
                c[(b + 12) >> 2] = r;
                c[a >> 2] = r;
                c[(r + 8) >> 2] = b;
                c[(r + 12) >> 2] = e;
                c[(r + 24) >> 2] = 0;
                break;
              } else $();
            }
          } else {
            c[2256] = b | d;
            c[e >> 2] = r;
            c[(r + 24) >> 2] = e;
            c[(r + 12) >> 2] = r;
            c[(r + 8) >> 2] = r;
          }
        while (0);
        r = ((c[2263] | 0) + -1) | 0;
        c[2263] = r;
        if (!r) a = 9476;
        else return;
        while (1) {
          a = c[a >> 2] | 0;
          if (!a) break;
          else a = (a + 8) | 0;
        }
        c[2263] = -1;
        return;
      }
      function ib(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0;
        if (a) {
          d = N(b, a) | 0;
          if ((b | a) >>> 0 > 65535)
            d = (((d >>> 0) / (a >>> 0)) | 0 | 0) == (b | 0) ? d : -1;
        } else d = 0;
        a = gb(d) | 0;
        if (!a) return a | 0;
        if (!(c[(a + -4) >> 2] & 3)) return a | 0;
        ob(a | 0, 0, d | 0) | 0;
        return a | 0;
      }
      function jb(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0,
          e = 0;
        if (!a) {
          b = gb(b) | 0;
          return b | 0;
        }
        if (b >>> 0 > 4294967231) {
          c[(Wa() | 0) >> 2] = 12;
          b = 0;
          return b | 0;
        }
        d = kb((a + -8) | 0, b >>> 0 < 11 ? 16 : (b + 11) & -8) | 0;
        if (d | 0) {
          b = (d + 8) | 0;
          return b | 0;
        }
        d = gb(b) | 0;
        if (!d) {
          b = 0;
          return b | 0;
        }
        e = c[(a + -4) >> 2] | 0;
        e = ((e & -8) - (((e & 3) | 0) == 0 ? 8 : 4)) | 0;
        tb(d | 0, a | 0, (e >>> 0 < b >>> 0 ? e : b) | 0) | 0;
        hb(a);
        b = d;
        return b | 0;
      }
      function kb(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0;
        o = (a + 4) | 0;
        n = c[o >> 2] | 0;
        d = n & -8;
        k = (a + d) | 0;
        i = c[2259] | 0;
        e = n & 3;
        if (!(((e | 0) != 1) & (a >>> 0 >= i >>> 0) & (a >>> 0 < k >>> 0))) $();
        f = c[(k + 4) >> 2] | 0;
        if (!(f & 1)) $();
        if (!e) {
          if (b >>> 0 < 256) {
            a = 0;
            return a | 0;
          }
          if (
            d >>> 0 >= ((b + 4) | 0) >>> 0
              ? ((d - b) | 0) >>> 0 <= (c[2375] << 1) >>> 0
              : 0
          )
            return a | 0;
          a = 0;
          return a | 0;
        }
        if (d >>> 0 >= b >>> 0) {
          d = (d - b) | 0;
          if (d >>> 0 <= 15) return a | 0;
          m = (a + b) | 0;
          c[o >> 2] = (n & 1) | b | 2;
          c[(m + 4) >> 2] = d | 3;
          o = (m + d + 4) | 0;
          c[o >> 2] = c[o >> 2] | 1;
          lb(m, d);
          return a | 0;
        }
        if ((k | 0) == (c[2261] | 0)) {
          m = ((c[2258] | 0) + d) | 0;
          d = (m - b) | 0;
          e = (a + b) | 0;
          if (m >>> 0 <= b >>> 0) {
            a = 0;
            return a | 0;
          }
          c[o >> 2] = (n & 1) | b | 2;
          c[(e + 4) >> 2] = d | 1;
          c[2261] = e;
          c[2258] = d;
          return a | 0;
        }
        if ((k | 0) == (c[2260] | 0)) {
          f = ((c[2257] | 0) + d) | 0;
          if (f >>> 0 < b >>> 0) {
            a = 0;
            return a | 0;
          }
          d = (f - b) | 0;
          e = n & 1;
          if (d >>> 0 > 15) {
            n = (a + b) | 0;
            m = (n + d) | 0;
            c[o >> 2] = e | b | 2;
            c[(n + 4) >> 2] = d | 1;
            c[m >> 2] = d;
            e = (m + 4) | 0;
            c[e >> 2] = c[e >> 2] & -2;
            e = n;
          } else {
            c[o >> 2] = e | f | 2;
            e = (a + f + 4) | 0;
            c[e >> 2] = c[e >> 2] | 1;
            e = 0;
            d = 0;
          }
          c[2257] = d;
          c[2260] = e;
          return a | 0;
        }
        if ((f & 2) | 0) {
          a = 0;
          return a | 0;
        }
        l = ((f & -8) + d) | 0;
        if (l >>> 0 < b >>> 0) {
          a = 0;
          return a | 0;
        }
        m = (l - b) | 0;
        g = f >>> 3;
        a: do
          if (f >>> 0 >= 256) {
            h = c[(k + 24) >> 2] | 0;
            f = c[(k + 12) >> 2] | 0;
            do
              if ((f | 0) == (k | 0)) {
                f = (k + 16) | 0;
                e = (f + 4) | 0;
                d = c[e >> 2] | 0;
                if (!d) {
                  d = c[f >> 2] | 0;
                  if (!d) {
                    j = 0;
                    break;
                  } else e = f;
                }
                while (1) {
                  f = (d + 20) | 0;
                  g = c[f >> 2] | 0;
                  if (g | 0) {
                    d = g;
                    e = f;
                    continue;
                  }
                  f = (d + 16) | 0;
                  g = c[f >> 2] | 0;
                  if (!g) break;
                  else {
                    d = g;
                    e = f;
                  }
                }
                if (e >>> 0 < i >>> 0) $();
                else {
                  c[e >> 2] = 0;
                  j = d;
                  break;
                }
              } else {
                g = c[(k + 8) >> 2] | 0;
                if (g >>> 0 < i >>> 0) $();
                d = (g + 12) | 0;
                if ((c[d >> 2] | 0) != (k | 0)) $();
                e = (f + 8) | 0;
                if ((c[e >> 2] | 0) == (k | 0)) {
                  c[d >> 2] = f;
                  c[e >> 2] = g;
                  j = f;
                  break;
                } else $();
              }
            while (0);
            if (h | 0) {
              d = c[(k + 28) >> 2] | 0;
              e = (9324 + (d << 2)) | 0;
              do
                if ((k | 0) == (c[e >> 2] | 0)) {
                  c[e >> 2] = j;
                  if (!j) {
                    c[2256] = c[2256] & ~(1 << d);
                    break a;
                  }
                } else if (h >>> 0 >= (c[2259] | 0) >>> 0) {
                  c[
                    (h +
                      16 +
                      ((((c[(h + 16) >> 2] | 0) != (k | 0)) & 1) << 2)) >>
                      2
                  ] = j;
                  if (!j) break a;
                  else break;
                } else $();
              while (0);
              f = c[2259] | 0;
              if (j >>> 0 < f >>> 0) $();
              c[(j + 24) >> 2] = h;
              d = (k + 16) | 0;
              e = c[d >> 2] | 0;
              do
                if (e | 0)
                  if (e >>> 0 < f >>> 0) $();
                  else {
                    c[(j + 16) >> 2] = e;
                    c[(e + 24) >> 2] = j;
                    break;
                  }
              while (0);
              d = c[(d + 4) >> 2] | 0;
              if (d | 0)
                if (d >>> 0 < (c[2259] | 0) >>> 0) $();
                else {
                  c[(j + 20) >> 2] = d;
                  c[(d + 24) >> 2] = j;
                  break;
                }
            }
          } else {
            e = c[(k + 8) >> 2] | 0;
            f = c[(k + 12) >> 2] | 0;
            d = (9060 + ((g << 1) << 2)) | 0;
            if ((e | 0) != (d | 0)) {
              if (e >>> 0 < i >>> 0) $();
              if ((c[(e + 12) >> 2] | 0) != (k | 0)) $();
            }
            if ((f | 0) == (e | 0)) {
              c[2255] = c[2255] & ~(1 << g);
              break;
            }
            if ((f | 0) != (d | 0)) {
              if (f >>> 0 < i >>> 0) $();
              d = (f + 8) | 0;
              if ((c[d >> 2] | 0) == (k | 0)) h = d;
              else $();
            } else h = (f + 8) | 0;
            c[(e + 12) >> 2] = f;
            c[h >> 2] = e;
          }
        while (0);
        d = n & 1;
        if (m >>> 0 < 16) {
          c[o >> 2] = l | d | 2;
          o = (a + l + 4) | 0;
          c[o >> 2] = c[o >> 2] | 1;
          return a | 0;
        } else {
          n = (a + b) | 0;
          c[o >> 2] = d | b | 2;
          c[(n + 4) >> 2] = m | 3;
          o = (n + m + 4) | 0;
          c[o >> 2] = c[o >> 2] | 1;
          lb(n, m);
          return a | 0;
        }
        return 0;
      }
      function lb(a, b) {
        a = a | 0;
        b = b | 0;
        var d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          k = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0;
        o = (a + b) | 0;
        d = c[(a + 4) >> 2] | 0;
        a: do
          if (!(d & 1)) {
            g = c[a >> 2] | 0;
            if (!(d & 3)) return;
            l = (a + (0 - g)) | 0;
            k = (g + b) | 0;
            i = c[2259] | 0;
            if (l >>> 0 < i >>> 0) $();
            if ((l | 0) == (c[2260] | 0)) {
              a = (o + 4) | 0;
              d = c[a >> 2] | 0;
              if (((d & 3) | 0) != 3) {
                r = l;
                f = k;
                break;
              }
              c[2257] = k;
              c[a >> 2] = d & -2;
              c[(l + 4) >> 2] = k | 1;
              c[(l + k) >> 2] = k;
              return;
            }
            e = g >>> 3;
            if (g >>> 0 < 256) {
              d = c[(l + 8) >> 2] | 0;
              b = c[(l + 12) >> 2] | 0;
              a = (9060 + ((e << 1) << 2)) | 0;
              if ((d | 0) != (a | 0)) {
                if (d >>> 0 < i >>> 0) $();
                if ((c[(d + 12) >> 2] | 0) != (l | 0)) $();
              }
              if ((b | 0) == (d | 0)) {
                c[2255] = c[2255] & ~(1 << e);
                r = l;
                f = k;
                break;
              }
              if ((b | 0) != (a | 0)) {
                if (b >>> 0 < i >>> 0) $();
                a = (b + 8) | 0;
                if ((c[a >> 2] | 0) == (l | 0)) h = a;
                else $();
              } else h = (b + 8) | 0;
              c[(d + 12) >> 2] = b;
              c[h >> 2] = d;
              r = l;
              f = k;
              break;
            }
            g = c[(l + 24) >> 2] | 0;
            b = c[(l + 12) >> 2] | 0;
            do
              if ((b | 0) == (l | 0)) {
                b = (l + 16) | 0;
                d = (b + 4) | 0;
                a = c[d >> 2] | 0;
                if (!a) {
                  a = c[b >> 2] | 0;
                  if (!a) {
                    j = 0;
                    break;
                  } else d = b;
                }
                while (1) {
                  b = (a + 20) | 0;
                  e = c[b >> 2] | 0;
                  if (e | 0) {
                    a = e;
                    d = b;
                    continue;
                  }
                  b = (a + 16) | 0;
                  e = c[b >> 2] | 0;
                  if (!e) break;
                  else {
                    a = e;
                    d = b;
                  }
                }
                if (d >>> 0 < i >>> 0) $();
                else {
                  c[d >> 2] = 0;
                  j = a;
                  break;
                }
              } else {
                e = c[(l + 8) >> 2] | 0;
                if (e >>> 0 < i >>> 0) $();
                a = (e + 12) | 0;
                if ((c[a >> 2] | 0) != (l | 0)) $();
                d = (b + 8) | 0;
                if ((c[d >> 2] | 0) == (l | 0)) {
                  c[a >> 2] = b;
                  c[d >> 2] = e;
                  j = b;
                  break;
                } else $();
              }
            while (0);
            if (g) {
              a = c[(l + 28) >> 2] | 0;
              d = (9324 + (a << 2)) | 0;
              do
                if ((l | 0) == (c[d >> 2] | 0)) {
                  c[d >> 2] = j;
                  if (!j) {
                    c[2256] = c[2256] & ~(1 << a);
                    r = l;
                    f = k;
                    break a;
                  }
                } else if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                  c[
                    (g +
                      16 +
                      ((((c[(g + 16) >> 2] | 0) != (l | 0)) & 1) << 2)) >>
                      2
                  ] = j;
                  if (!j) {
                    r = l;
                    f = k;
                    break a;
                  } else break;
                } else $();
              while (0);
              b = c[2259] | 0;
              if (j >>> 0 < b >>> 0) $();
              c[(j + 24) >> 2] = g;
              a = (l + 16) | 0;
              d = c[a >> 2] | 0;
              do
                if (d | 0)
                  if (d >>> 0 < b >>> 0) $();
                  else {
                    c[(j + 16) >> 2] = d;
                    c[(d + 24) >> 2] = j;
                    break;
                  }
              while (0);
              a = c[(a + 4) >> 2] | 0;
              if (a)
                if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                else {
                  c[(j + 20) >> 2] = a;
                  c[(a + 24) >> 2] = j;
                  r = l;
                  f = k;
                  break;
                }
              else {
                r = l;
                f = k;
              }
            } else {
              r = l;
              f = k;
            }
          } else {
            r = a;
            f = b;
          }
        while (0);
        h = c[2259] | 0;
        if (o >>> 0 < h >>> 0) $();
        a = (o + 4) | 0;
        d = c[a >> 2] | 0;
        if (!(d & 2)) {
          a = c[2260] | 0;
          if ((o | 0) == (c[2261] | 0)) {
            q = ((c[2258] | 0) + f) | 0;
            c[2258] = q;
            c[2261] = r;
            c[(r + 4) >> 2] = q | 1;
            if ((r | 0) != (a | 0)) return;
            c[2260] = 0;
            c[2257] = 0;
            return;
          }
          if ((o | 0) == (a | 0)) {
            q = ((c[2257] | 0) + f) | 0;
            c[2257] = q;
            c[2260] = r;
            c[(r + 4) >> 2] = q | 1;
            c[(r + q) >> 2] = q;
            return;
          }
          f = ((d & -8) + f) | 0;
          e = d >>> 3;
          b: do
            if (d >>> 0 >= 256) {
              g = c[(o + 24) >> 2] | 0;
              b = c[(o + 12) >> 2] | 0;
              do
                if ((b | 0) == (o | 0)) {
                  b = (o + 16) | 0;
                  d = (b + 4) | 0;
                  a = c[d >> 2] | 0;
                  if (!a) {
                    a = c[b >> 2] | 0;
                    if (!a) {
                      n = 0;
                      break;
                    } else d = b;
                  }
                  while (1) {
                    b = (a + 20) | 0;
                    e = c[b >> 2] | 0;
                    if (e | 0) {
                      a = e;
                      d = b;
                      continue;
                    }
                    b = (a + 16) | 0;
                    e = c[b >> 2] | 0;
                    if (!e) break;
                    else {
                      a = e;
                      d = b;
                    }
                  }
                  if (d >>> 0 < h >>> 0) $();
                  else {
                    c[d >> 2] = 0;
                    n = a;
                    break;
                  }
                } else {
                  e = c[(o + 8) >> 2] | 0;
                  if (e >>> 0 < h >>> 0) $();
                  a = (e + 12) | 0;
                  if ((c[a >> 2] | 0) != (o | 0)) $();
                  d = (b + 8) | 0;
                  if ((c[d >> 2] | 0) == (o | 0)) {
                    c[a >> 2] = b;
                    c[d >> 2] = e;
                    n = b;
                    break;
                  } else $();
                }
              while (0);
              if (g | 0) {
                a = c[(o + 28) >> 2] | 0;
                d = (9324 + (a << 2)) | 0;
                do
                  if ((o | 0) == (c[d >> 2] | 0)) {
                    c[d >> 2] = n;
                    if (!n) {
                      c[2256] = c[2256] & ~(1 << a);
                      break b;
                    }
                  } else if (g >>> 0 >= (c[2259] | 0) >>> 0) {
                    c[
                      (g +
                        16 +
                        ((((c[(g + 16) >> 2] | 0) != (o | 0)) & 1) << 2)) >>
                        2
                    ] = n;
                    if (!n) break b;
                    else break;
                  } else $();
                while (0);
                b = c[2259] | 0;
                if (n >>> 0 < b >>> 0) $();
                c[(n + 24) >> 2] = g;
                a = (o + 16) | 0;
                d = c[a >> 2] | 0;
                do
                  if (d | 0)
                    if (d >>> 0 < b >>> 0) $();
                    else {
                      c[(n + 16) >> 2] = d;
                      c[(d + 24) >> 2] = n;
                      break;
                    }
                while (0);
                a = c[(a + 4) >> 2] | 0;
                if (a | 0)
                  if (a >>> 0 < (c[2259] | 0) >>> 0) $();
                  else {
                    c[(n + 20) >> 2] = a;
                    c[(a + 24) >> 2] = n;
                    break;
                  }
              }
            } else {
              d = c[(o + 8) >> 2] | 0;
              b = c[(o + 12) >> 2] | 0;
              a = (9060 + ((e << 1) << 2)) | 0;
              if ((d | 0) != (a | 0)) {
                if (d >>> 0 < h >>> 0) $();
                if ((c[(d + 12) >> 2] | 0) != (o | 0)) $();
              }
              if ((b | 0) == (d | 0)) {
                c[2255] = c[2255] & ~(1 << e);
                break;
              }
              if ((b | 0) != (a | 0)) {
                if (b >>> 0 < h >>> 0) $();
                a = (b + 8) | 0;
                if ((c[a >> 2] | 0) == (o | 0)) m = a;
                else $();
              } else m = (b + 8) | 0;
              c[(d + 12) >> 2] = b;
              c[m >> 2] = d;
            }
          while (0);
          c[(r + 4) >> 2] = f | 1;
          c[(r + f) >> 2] = f;
          if ((r | 0) == (c[2260] | 0)) {
            c[2257] = f;
            return;
          }
        } else {
          c[a >> 2] = d & -2;
          c[(r + 4) >> 2] = f | 1;
          c[(r + f) >> 2] = f;
        }
        a = f >>> 3;
        if (f >>> 0 < 256) {
          b = (9060 + ((a << 1) << 2)) | 0;
          d = c[2255] | 0;
          a = 1 << a;
          if (d & a) {
            a = (b + 8) | 0;
            d = c[a >> 2] | 0;
            if (d >>> 0 < (c[2259] | 0) >>> 0) $();
            else {
              p = d;
              q = a;
            }
          } else {
            c[2255] = d | a;
            p = b;
            q = (b + 8) | 0;
          }
          c[q >> 2] = r;
          c[(p + 12) >> 2] = r;
          c[(r + 8) >> 2] = p;
          c[(r + 12) >> 2] = b;
          return;
        }
        a = f >>> 8;
        if (a)
          if (f >>> 0 > 16777215) a = 31;
          else {
            p = (((a + 1048320) | 0) >>> 16) & 8;
            q = a << p;
            o = (((q + 520192) | 0) >>> 16) & 4;
            q = q << o;
            a = (((q + 245760) | 0) >>> 16) & 2;
            a = (14 - (o | p | a) + ((q << a) >>> 15)) | 0;
            a = ((f >>> ((a + 7) | 0)) & 1) | (a << 1);
          }
        else a = 0;
        e = (9324 + (a << 2)) | 0;
        c[(r + 28) >> 2] = a;
        c[(r + 20) >> 2] = 0;
        c[(r + 16) >> 2] = 0;
        d = c[2256] | 0;
        b = 1 << a;
        if (!(d & b)) {
          c[2256] = d | b;
          c[e >> 2] = r;
          c[(r + 24) >> 2] = e;
          c[(r + 12) >> 2] = r;
          c[(r + 8) >> 2] = r;
          return;
        }
        d = f << ((a | 0) == 31 ? 0 : (25 - (a >>> 1)) | 0);
        e = c[e >> 2] | 0;
        while (1) {
          if (((c[(e + 4) >> 2] & -8) | 0) == (f | 0)) {
            a = 121;
            break;
          }
          b = (e + 16 + ((d >>> 31) << 2)) | 0;
          a = c[b >> 2] | 0;
          if (!a) {
            a = 118;
            break;
          } else {
            d = d << 1;
            e = a;
          }
        }
        if ((a | 0) == 118) {
          if (b >>> 0 < (c[2259] | 0) >>> 0) $();
          c[b >> 2] = r;
          c[(r + 24) >> 2] = e;
          c[(r + 12) >> 2] = r;
          c[(r + 8) >> 2] = r;
          return;
        } else if ((a | 0) == 121) {
          a = (e + 8) | 0;
          d = c[a >> 2] | 0;
          q = c[2259] | 0;
          if (!((d >>> 0 >= q >>> 0) & (e >>> 0 >= q >>> 0))) $();
          c[(d + 12) >> 2] = r;
          c[a >> 2] = r;
          c[(r + 8) >> 2] = d;
          c[(r + 12) >> 2] = e;
          c[(r + 24) >> 2] = 0;
          return;
        }
      }
      function mb() {}
      function nb(a, b, c, d) {
        a = a | 0;
        b = b | 0;
        c = c | 0;
        d = d | 0;
        c = (a + c) >>> 0;
        return ((y = (b + d + ((c >>> 0 < a >>> 0) | 0)) >>> 0), c | 0) | 0;
      }
      function ob(b, d, e) {
        b = b | 0;
        d = d | 0;
        e = e | 0;
        var f = 0,
          g = 0,
          h = 0,
          i = 0;
        h = (b + e) | 0;
        d = d & 255;
        if ((e | 0) >= 67) {
          while (b & 3) {
            a[b >> 0] = d;
            b = (b + 1) | 0;
          }
          f = (h & -4) | 0;
          g = (f - 64) | 0;
          i = d | (d << 8) | (d << 16) | (d << 24);
          while ((b | 0) <= (g | 0)) {
            c[b >> 2] = i;
            c[(b + 4) >> 2] = i;
            c[(b + 8) >> 2] = i;
            c[(b + 12) >> 2] = i;
            c[(b + 16) >> 2] = i;
            c[(b + 20) >> 2] = i;
            c[(b + 24) >> 2] = i;
            c[(b + 28) >> 2] = i;
            c[(b + 32) >> 2] = i;
            c[(b + 36) >> 2] = i;
            c[(b + 40) >> 2] = i;
            c[(b + 44) >> 2] = i;
            c[(b + 48) >> 2] = i;
            c[(b + 52) >> 2] = i;
            c[(b + 56) >> 2] = i;
            c[(b + 60) >> 2] = i;
            b = (b + 64) | 0;
          }
          while ((b | 0) < (f | 0)) {
            c[b >> 2] = i;
            b = (b + 4) | 0;
          }
        }
        while ((b | 0) < (h | 0)) {
          a[b >> 0] = d;
          b = (b + 1) | 0;
        }
        return (h - e) | 0;
      }
      function pb(a, b, c) {
        a = a | 0;
        b = b | 0;
        c = c | 0;
        if ((c | 0) < 32) {
          y = b >>> c;
          return (a >>> c) | ((b & ((1 << c) - 1)) << (32 - c));
        }
        y = 0;
        return (b >>> (c - 32)) | 0;
      }
      function qb(a, b) {
        a = a | 0;
        b = b | 0;
        var c = 0,
          d = 0,
          e = 0,
          f = 0;
        f = a & 65535;
        e = b & 65535;
        c = N(e, f) | 0;
        d = a >>> 16;
        a = ((c >>> 16) + (N(e, d) | 0)) | 0;
        e = b >>> 16;
        b = N(e, f) | 0;
        return (
          ((y =
            ((a >>> 16) + (N(e, d) | 0) + ((((a & 65535) + b) | 0) >>> 16)) |
            0),
          ((a + b) << 16) | (c & 65535) | 0) | 0
        );
      }
      function rb(a, b, c, d) {
        a = a | 0;
        b = b | 0;
        c = c | 0;
        d = d | 0;
        var e = 0,
          f = 0;
        e = a;
        f = c;
        c = qb(e, f) | 0;
        a = y;
        return (
          ((y = ((N(b, f) | 0) + (N(d, e) | 0) + a) | (a & 0)), c | 0 | 0) | 0
        );
      }
      function sb(a) {
        a = a | 0;
        var b = 0,
          d = 0;
        d = ((a + 15) & -16) | 0;
        b = c[i >> 2] | 0;
        a = (b + d) | 0;
        if ((((d | 0) > 0) & ((a | 0) < (b | 0))) | ((a | 0) < 0)) {
          V() | 0;
          aa(12);
          return -1;
        }
        c[i >> 2] = a;
        if ((a | 0) > (U() | 0) ? (T() | 0) == 0 : 0) {
          c[i >> 2] = b;
          aa(12);
          return -1;
        }
        return b | 0;
      }
      function tb(b, d, e) {
        b = b | 0;
        d = d | 0;
        e = e | 0;
        var f = 0,
          g = 0,
          h = 0;
        if ((e | 0) >= 8192) return da(b | 0, d | 0, e | 0) | 0;
        h = b | 0;
        g = (b + e) | 0;
        if ((b & 3) == (d & 3)) {
          while (b & 3) {
            if (!e) return h | 0;
            a[b >> 0] = a[d >> 0] | 0;
            b = (b + 1) | 0;
            d = (d + 1) | 0;
            e = (e - 1) | 0;
          }
          e = (g & -4) | 0;
          f = (e - 64) | 0;
          while ((b | 0) <= (f | 0)) {
            c[b >> 2] = c[d >> 2];
            c[(b + 4) >> 2] = c[(d + 4) >> 2];
            c[(b + 8) >> 2] = c[(d + 8) >> 2];
            c[(b + 12) >> 2] = c[(d + 12) >> 2];
            c[(b + 16) >> 2] = c[(d + 16) >> 2];
            c[(b + 20) >> 2] = c[(d + 20) >> 2];
            c[(b + 24) >> 2] = c[(d + 24) >> 2];
            c[(b + 28) >> 2] = c[(d + 28) >> 2];
            c[(b + 32) >> 2] = c[(d + 32) >> 2];
            c[(b + 36) >> 2] = c[(d + 36) >> 2];
            c[(b + 40) >> 2] = c[(d + 40) >> 2];
            c[(b + 44) >> 2] = c[(d + 44) >> 2];
            c[(b + 48) >> 2] = c[(d + 48) >> 2];
            c[(b + 52) >> 2] = c[(d + 52) >> 2];
            c[(b + 56) >> 2] = c[(d + 56) >> 2];
            c[(b + 60) >> 2] = c[(d + 60) >> 2];
            b = (b + 64) | 0;
            d = (d + 64) | 0;
          }
          while ((b | 0) < (e | 0)) {
            c[b >> 2] = c[d >> 2];
            b = (b + 4) | 0;
            d = (d + 4) | 0;
          }
        } else {
          e = (g - 4) | 0;
          while ((b | 0) < (e | 0)) {
            a[b >> 0] = a[d >> 0] | 0;
            a[(b + 1) >> 0] = a[(d + 1) >> 0] | 0;
            a[(b + 2) >> 0] = a[(d + 2) >> 0] | 0;
            a[(b + 3) >> 0] = a[(d + 3) >> 0] | 0;
            b = (b + 4) | 0;
            d = (d + 4) | 0;
          }
        }
        while ((b | 0) < (g | 0)) {
          a[b >> 0] = a[d >> 0] | 0;
          b = (b + 1) | 0;
          d = (d + 1) | 0;
        }
        return h | 0;
      }
      function ub(a) {
        a = a | 0;
        return (
          ((a & 255) << 24) |
          (((a >> 8) & 255) << 16) |
          (((a >> 16) & 255) << 8) |
          (a >>> 24) |
          0
        );
      }
      function vb(a, b) {
        a = a | 0;
        b = b | 0;
        return ia[a & 1](b | 0) | 0;
      }
      function wb(a, b, c, d) {
        a = a | 0;
        b = b | 0;
        c = c | 0;
        d = d | 0;
        return ja[a & 3](b | 0, c | 0, d | 0) | 0;
      }
      function xb(a) {
        a = a | 0;
        R(0);
        return 0;
      }
      function yb(a, b, c) {
        a = a | 0;
        b = b | 0;
        c = c | 0;
        R(1);
        return 0;
      }

      // EMSCRIPTEN_END_FUNCS
      var ia = [xb, Sa];
      var ja = [yb, _a, Ua, Ta];
      return {
        _llvm_bswap_i32: ub,
        _shine_check_config: Ha,
        _shine_flush: La,
        setThrew: oa,
        _bitshift64Lshr: pb,
        _shine_samples_per_pass: Ia,
        _fflush: eb,
        _shine_js_init: Qa,
        _memset: ob,
        _sbrk: sb,
        _memcpy: tb,
        ___errno_location: Wa,
        _shine_encode_buffer: Ka,
        _shine_close: Ma,
        stackAlloc: ka,
        getTempRet0: qa,
        ___muldi3: rb,
        setTempRet0: pa,
        _i64Add: nb,
        _emscripten_get_global_libc: Ra,
        stackSave: la,
        ___muldsi3: qb,
        _free: hb,
        runPostSets: mb,
        establishStackSpace: na,
        stackRestore: ma,
        _malloc: gb,
        stackAlloc: ka,
        stackSave: la,
        stackRestore: ma,
        establishStackSpace: na,
        setThrew: oa,
        setTempRet0: pa,
        getTempRet0: qa,
        dynCall_ii: vb,
        dynCall_iiii: wb,
      };
    })(
      // EMSCRIPTEN_END_ASM
      Module.asmGlobalArg,
      Module.asmLibraryArg,
      buffer
    );
    var _llvm_bswap_i32 = (Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"]);
    var _shine_check_config = (Module["_shine_check_config"] =
      asm["_shine_check_config"]);
    var _shine_flush = (Module["_shine_flush"] = asm["_shine_flush"]);
    var setThrew = (Module["setThrew"] = asm["setThrew"]);
    var _bitshift64Lshr = (Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"]);
    var _shine_samples_per_pass = (Module["_shine_samples_per_pass"] =
      asm["_shine_samples_per_pass"]);
    var _fflush = (Module["_fflush"] = asm["_fflush"]);
    var _shine_js_init = (Module["_shine_js_init"] = asm["_shine_js_init"]);
    var _memset = (Module["_memset"] = asm["_memset"]);
    var _sbrk = (Module["_sbrk"] = asm["_sbrk"]);
    var _memcpy = (Module["_memcpy"] = asm["_memcpy"]);
    var ___errno_location = (Module["___errno_location"] =
      asm["___errno_location"]);
    var _shine_encode_buffer = (Module["_shine_encode_buffer"] =
      asm["_shine_encode_buffer"]);
    var _shine_close = (Module["_shine_close"] = asm["_shine_close"]);
    var stackAlloc = (Module["stackAlloc"] = asm["stackAlloc"]);
    var getTempRet0 = (Module["getTempRet0"] = asm["getTempRet0"]);
    var ___muldi3 = (Module["___muldi3"] = asm["___muldi3"]);
    var setTempRet0 = (Module["setTempRet0"] = asm["setTempRet0"]);
    var _i64Add = (Module["_i64Add"] = asm["_i64Add"]);
    var _emscripten_get_global_libc = (Module["_emscripten_get_global_libc"] =
      asm["_emscripten_get_global_libc"]);
    var stackSave = (Module["stackSave"] = asm["stackSave"]);
    var ___muldsi3 = (Module["___muldsi3"] = asm["___muldsi3"]);
    var _free = (Module["_free"] = asm["_free"]);
    var runPostSets = (Module["runPostSets"] = asm["runPostSets"]);
    var establishStackSpace = (Module["establishStackSpace"] =
      asm["establishStackSpace"]);
    var stackRestore = (Module["stackRestore"] = asm["stackRestore"]);
    var _malloc = (Module["_malloc"] = asm["_malloc"]);
    var dynCall_ii = (Module["dynCall_ii"] = asm["dynCall_ii"]);
    var dynCall_iiii = (Module["dynCall_iiii"] = asm["dynCall_iiii"]);
    Runtime.stackAlloc = Module["stackAlloc"];
    Runtime.stackSave = Module["stackSave"];
    Runtime.stackRestore = Module["stackRestore"];
    Runtime.establishStackSpace = Module["establishStackSpace"];
    Runtime.setTempRet0 = Module["setTempRet0"];
    Runtime.getTempRet0 = Module["getTempRet0"];
    Module["asm"] = asm;
    function ExitStatus(status) {
      this.name = "ExitStatus";
      this.message = "Program terminated with exit(" + status + ")";
      this.status = status;
    }
    ExitStatus.prototype = new Error();
    ExitStatus.prototype.constructor = ExitStatus;
    var initialStackTop;
    var preloadStartTime = null;
    var calledMain = false;
    dependenciesFulfilled = function runCaller() {
      if (!Module["calledRun"]) run();
      if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
    };
    Module["callMain"] = Module.callMain = function callMain(args) {
      args = args || [];
      ensureInitRuntime();
      var argc = args.length + 1;
      function pad() {
        for (var i = 0; i < 4 - 1; i++) {
          argv.push(0);
        }
      }
      var argv = [
        allocate(intArrayFromString(Module["thisProgram"]), "i8", ALLOC_NORMAL),
      ];
      pad();
      for (var i = 0; i < argc - 1; i = i + 1) {
        argv.push(allocate(intArrayFromString(args[i]), "i8", ALLOC_NORMAL));
        pad();
      }
      argv.push(0);
      argv = allocate(argv, "i32", ALLOC_NORMAL);
      try {
        var ret = Module["_main"](argc, argv, 0);
        exit(ret, true);
      } catch (e) {
        if (e instanceof ExitStatus) {
          return;
        } else if (e == "SimulateInfiniteLoop") {
          Module["noExitRuntime"] = true;
          return;
        } else {
          var toLog = e;
          if (e && typeof e === "object" && e.stack) {
            toLog = [e, e.stack];
          }
          Module.printErr("exception thrown: " + toLog);
          Module["quit"](1, e);
        }
      } finally {
        calledMain = true;
      }
    };
    function run(args) {
      args = args || Module["arguments"];
      if (preloadStartTime === null) preloadStartTime = Date.now();
      if (runDependencies > 0) {
        return;
      }
      preRun();
      if (runDependencies > 0) return;
      if (Module["calledRun"]) return;
      function doRun() {
        if (Module["calledRun"]) return;
        Module["calledRun"] = true;
        if (ABORT) return;
        ensureInitRuntime();
        preMain();
        if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
        if (Module["_main"] && shouldRunNow) Module["callMain"](args);
        postRun();
      }
      if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function() {
          setTimeout(function() {
            Module["setStatus"]("");
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }
    Module["run"] = Module.run = run;
    function exit(status, implicit) {
      if (implicit && Module["noExitRuntime"]) {
        return;
      }
      if (Module["noExitRuntime"]) {
      } else {
        ABORT = true;
        EXITSTATUS = status;
        STACKTOP = initialStackTop;
        exitRuntime();
        if (Module["onExit"]) Module["onExit"](status);
      }
      if (ENVIRONMENT_IS_NODE) {
        process["exit"](status);
      }
      Module["quit"](status, new ExitStatus(status));
    }
    Module["exit"] = Module.exit = exit;
    var abortDecorators = [];
    function abort(what) {
      if (Module["onAbort"]) {
        Module["onAbort"](what);
      }
      if (what !== undefined) {
        Module.print(what);
        Module.printErr(what);
        what = JSON.stringify(what);
      } else {
        what = "";
      }
      ABORT = true;
      EXITSTATUS = 1;
      var extra =
        "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
      var output = "abort(" + what + ") at " + stackTrace() + extra;
      if (abortDecorators) {
        abortDecorators.forEach(function(decorator) {
          output = decorator(output, what);
        });
      }
      throw output;
    }
    Module["abort"] = Module.abort = abort;
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].pop()();
      }
    }
    var shouldRunNow = true;
    if (Module["noInitialRun"]) {
      shouldRunNow = false;
    }
    run();
    var isNode = typeof process === "object" && typeof require === "function";
    var int16Len = Module.HEAP16.BYTES_PER_ELEMENT;
    var ptrLen = Module.HEAP32.BYTES_PER_ELEMENT;
    function Shine(args) {
      if (_shine_check_config(args.samplerate, args.bitrate) < 0)
        throw "Invalid configuration";
      var mode;
      if (!args.mode) {
        if (args.channels === 1) {
          mode = Shine.MONO;
        } else {
          mode = Shine.JOINT_STEREO;
        }
      } else {
        mode = args.mode;
      }
      this._handle = _shine_js_init(
        args.channels,
        args.samplerate,
        mode,
        args.bitrate
      );
      this._channels = args.channels;
      this._samples_per_pass = _shine_samples_per_pass(this._handle);
      this._buffer = _malloc(this._channels * ptrLen);
      this._pcm = new Array(this._channels);
      this._rem = new Array(this._channels);
      this._written = _malloc(int16Len);
      var _tmp, chan;
      for (chan = 0; chan < this._channels; chan++) {
        this._rem[chan] = new Int16Array();
        _tmp = _malloc(this._samples_per_pass * int16Len);
        setValue(this._buffer + chan * ptrLen, _tmp, "*");
        this._pcm[chan] = Module.HEAP16.subarray(
          _tmp / int16Len,
          _tmp / int16Len + this._samples_per_pass
        );
      }
      return this;
    }
    Shine.STEREO = 0;
    Shine.JOINT_STEREO = 1;
    Shine.DUAL_CHANNEL = 2;
    Shine.MONO = 3;
    Shine.prototype._encodePass = function(data) {
      if (!this._handle) throw "Closed";
      var chan;
      for (chan = 0; chan < this._channels; chan++)
        this._pcm[chan].set(data[chan]);
      var _buf = _shine_encode_buffer(
        this._handle,
        this._buffer,
        this._written
      );
      var written = getValue(this._written, "i16");
      return Module.HEAPU8.subarray(_buf, _buf + written);
    };
    function concat(ctr, a, b) {
      if (typeof b === "undefined") {
        return a;
      }
      var ret = new ctr(a.length + b.length);
      ret.set(a);
      ret.subarray(a.length).set(b);
      return ret;
    }
    function clip(x) {
      return x > 1 ? 1 : x < -1 ? -1 : x;
    }
    function convertFloat32(buf) {
      var ret = new Array(buf.length);
      var samples = buf[0].length;
      var chan, i;
      for (chan = 0; chan < buf.length; chan++) {
        ret[chan] = new Int16Array(samples);
        for (i = 0; i < samples; i++) {
          ret[chan][i] = parseInt(clip(buf[chan][i]) * 32767);
        }
      }
      return ret;
    }
    Shine.prototype.encode = function(data) {
      if (data.length != this._channels) throw "Invalid data";
      var encoded = new Uint8Array();
      var tmp = new Array(this._channels);
      if (data[0] instanceof Float32Array) {
        data = convertFloat32(data);
      }
      var chan;
      for (chan = 0; chan < this._channels; chan++) {
        tmp[chan] = new Float32Array();
        this._rem[chan] = concat(Int16Array, this._rem[chan], data[chan]);
      }
      var i, enc;
      for (i = 0; i < this._rem[0].length; i += this._samples_per_pass) {
        for (chan = 0; chan < this._channels; chan++) {
          tmp[chan] = this._rem[chan].subarray(i, i + this._samples_per_pass);
        }
        if (tmp[0].length < this._samples_per_pass) {
          break;
        } else {
          enc = this._encodePass(tmp);
          if (enc.length > 0) {
            encoded = concat(Uint8Array, encoded, enc);
          }
        }
      }
      if (tmp[0].length < this._samples_per_pass) {
        this._rem = tmp;
      } else {
        for (chan = 0; chan < this._channels; chan++) {
          this._rem[chan] = new Int16Array();
        }
      }
      return encoded;
    };
    Shine.prototype.close = function() {
      if (!this._handle) {
        throw "Closed";
      }
      var _buf = _shine_flush(this._handle, this._written);
      var written = getValue(this._written, "i16");
      var encoded = new Uint8Array(written);
      encoded.set(Module.HEAPU8.subarray(_buf, _buf + written));
      _free(this._written);
      _shine_close(this._handle);
      this._handle = null;
      var chan;
      for (chan = 0; chan < this._channels; chan++) {
        _free(getValue(this._buffer + chan * ptrLen, "*"));
      }
      _free(this._buffer);
      return encoded;
    };
    if (isNode) {
      module.exports = Shine;
    }
    return Shine;
  }.call(context);
})();

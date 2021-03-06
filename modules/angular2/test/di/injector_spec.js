import {isBlank} from 'angular2/src/facade/lang';
import {describe, ddescribe, it, iit, expect, beforeEach} from 'angular2/test_lib';
import {Injector, Inject, InjectLazy, Optional, bind, ResolvedBinding} from 'angular2/di';

class Engine {
}

class BrokenEngine {
  constructor() {
    throw "Broken Engine";
  }
}

class DashboardSoftware {
}

class Dashboard {
  constructor(software: DashboardSoftware) {}
}

class TurboEngine extends Engine {
}

class Car {
  engine:Engine;
  constructor(engine:Engine) {
    this.engine = engine;
  }
}

class CarWithLazyEngine {
  engineFactory;
  constructor(@InjectLazy(Engine) engineFactory) {
    this.engineFactory = engineFactory;
  }
}

class CarWithOptionalEngine {
  engine;
  constructor(@Optional() engine:Engine) {
    this.engine = engine;
  }
}

class CarWithDashboard {
  engine:Engine;
  dashboard:Dashboard;
  constructor(engine:Engine, dashboard:Dashboard) {
    this.engine = engine;
    this.dashboard = dashboard;
  }
}

class SportsCar extends Car {
  engine:Engine;
  constructor(engine:Engine) {
    super(engine);
  }
}

class CarWithInject {
  engine:Engine;
  constructor(@Inject(TurboEngine) engine:Engine) {
    this.engine = engine;
  }
}

class CyclicEngine {
  constructor(car:Car) {}
}

class NoAnnotations {
  constructor(secretDependency) {}
}

export function main() {
  describe('injector', function () {
    it('should instantiate a class without dependencies', function () {
      var injector = Injector.resolveAndCreate([Engine]);
      var engine = injector.get(Engine);

      expect(engine).toBeAnInstanceOf(Engine);
    });

    it('should resolve dependencies based on type information', function () {
      var injector = Injector.resolveAndCreate([Engine, Car]);
      var car = injector.get(Car);

      expect(car).toBeAnInstanceOf(Car);
      expect(car.engine).toBeAnInstanceOf(Engine);
    });

    it('should resolve dependencies based on @Inject annotation', function () {
      var injector = Injector.resolveAndCreate([TurboEngine, Engine, CarWithInject]);
      var car = injector.get(CarWithInject);

      expect(car).toBeAnInstanceOf(CarWithInject);
      expect(car.engine).toBeAnInstanceOf(TurboEngine);
    });

    it('should throw when no type and not @Inject', function () {
      expect(() => Injector.resolveAndCreate([NoAnnotations])).toThrowError(
        'Cannot resolve all parameters for NoAnnotations');
    });

    it('should cache instances', function () {
      var injector = Injector.resolveAndCreate([Engine]);

      var e1 = injector.get(Engine);
      var e2 = injector.get(Engine);

      expect(e1).toBe(e2);
    });

    it('should bind to a value', function () {
      var injector = Injector.resolveAndCreate([
        bind(Engine).toValue("fake engine")
      ]);

      var engine = injector.get(Engine);
      expect(engine).toEqual("fake engine");
    });

    it('should bind to a factory', function () {
      function sportsCarFactory(e:Engine) {
        return new SportsCar(e);
      }

      var injector = Injector.resolveAndCreate([
        Engine,
        bind(Car).toFactory(sportsCarFactory)
      ]);

      var car = injector.get(Car);
      expect(car).toBeAnInstanceOf(SportsCar);
      expect(car.engine).toBeAnInstanceOf(Engine);
    });

    it('should bind to an alias', function() {
      var injector = Injector.resolveAndCreate([
        Engine,
        bind(SportsCar).toClass(SportsCar),
        bind(Car).toAlias(SportsCar)
      ]);

      var car = injector.get(Car);
      var sportsCar = injector.get(SportsCar);
      expect(car).toBeAnInstanceOf(SportsCar);
      expect(car).toBe(sportsCar);
    });

    it('should throw when the aliased binding does not exist', function () {
      var injector = Injector.resolveAndCreate([
        bind('car').toAlias(SportsCar)
      ]);
      expect(() => injector.get('car')).toThrowError('No provider for SportsCar! (car -> SportsCar)');
    });

    it('should support overriding factory dependencies', function () {
      var injector = Injector.resolveAndCreate([
        Engine,
        bind(Car).toFactory((e) => new SportsCar(e), [Engine])
      ]);

      var car = injector.get(Car);
      expect(car).toBeAnInstanceOf(SportsCar);
      expect(car.engine).toBeAnInstanceOf(Engine);
    });

    it('should support optional dependencies', function () {
      var injector = Injector.resolveAndCreate([
        CarWithOptionalEngine
      ]);

      var car = injector.get(CarWithOptionalEngine);
      expect(car.engine).toEqual(null);
    });

    it("should flatten passed-in bindings", function () {
      var injector = Injector.resolveAndCreate([
        [[Engine, Car]]
      ]);

      var car = injector.get(Car);
      expect(car).toBeAnInstanceOf(Car);
    });

    it("should use the last binding "+
      "when there are mutliple bindings for same token", function () {
      var injector = Injector.resolveAndCreate([
        bind(Engine).toClass(Engine),
        bind(Engine).toClass(TurboEngine)
      ]);

      expect(injector.get(Engine)).toBeAnInstanceOf(TurboEngine);
    });

    it('should use non-type tokens', function () {
      var injector = Injector.resolveAndCreate([
        bind('token').toValue('value')
      ]);

      expect(injector.get('token')).toEqual('value');
    });

    it('should throw when given invalid bindings', function () {
      expect(() => Injector.resolveAndCreate(["blah"])).toThrowError('Invalid binding blah');
      expect(() => Injector.resolveAndCreate([bind("blah")])).toThrowError('Invalid binding blah');
    });

    it('should provide itself', function () {
      var parent = Injector.resolveAndCreate([]);
      var child = parent.resolveAndCreateChild([]);

      expect(child.get(Injector)).toBe(child);
    });

    it('should throw when no provider defined', function () {
      var injector = Injector.resolveAndCreate([]);
      expect(() => injector.get('NonExisting')).toThrowError('No provider for NonExisting!');
    });

    it('should show the full path when no provider', function () {
      var injector = Injector.resolveAndCreate([CarWithDashboard, Engine, Dashboard]);
      expect(() => injector.get(CarWithDashboard)).
        toThrowError('No provider for DashboardSoftware! (CarWithDashboard -> Dashboard -> DashboardSoftware)');
    });

    it('should throw when trying to instantiate a cyclic dependency', function () {
      var injector = Injector.resolveAndCreate([
        Car,
        bind(Engine).toClass(CyclicEngine)
      ]);

      expect(() => injector.get(Car))
        .toThrowError('Cannot instantiate cyclic dependency! (Car -> Engine -> Car)');

      expect(() => injector.asyncGet(Car))
        .toThrowError('Cannot instantiate cyclic dependency! (Car -> Engine -> Car)');
    });

    it('should show the full path when error happens in a constructor', function () {
      var injector = Injector.resolveAndCreate([
        Car,
        bind(Engine).toClass(BrokenEngine)
      ]);

      try {
        injector.get(Car);
        throw "Must throw";
      } catch (e) {
        expect(e.message).toContain("Error during instantiation of Engine! (Car -> Engine)");
      }
    });

    it('should instantiate an object after a failed attempt', function () {
      var isBroken = true;

      var injector = Injector.resolveAndCreate([
        Car,
        bind(Engine).toFactory(() => isBroken ? new BrokenEngine() : new Engine())
      ]);

      expect(() => injector.get(Car)).toThrowError(new RegExp("Error"));

      isBroken = false;

      expect(injector.get(Car)).toBeAnInstanceOf(Car);
    });

    it('should support null values', () => {
      var injector = Injector.resolveAndCreate([bind('null').toValue(null)]);
      expect(injector.get('null')).toBe(null);
    });

    describe("default bindings", function () {
      it("should be used when no matching binding found", function () {
        var injector = Injector.resolveAndCreate([], {defaultBindings: true});

        var car = injector.get(Car);

        expect(car).toBeAnInstanceOf(Car);
      });

      it("should use the matching binding when it is available", function () {
        var injector = Injector.resolveAndCreate([
          bind(Car).toClass(SportsCar)
        ], {defaultBindings: true});

        var car = injector.get(Car);

        expect(car).toBeAnInstanceOf(SportsCar);
      });
    });

    describe("child", function () {
      it('should load instances from parent injector', function () {
        var parent = Injector.resolveAndCreate([Engine]);
        var child = parent.resolveAndCreateChild([]);

        var engineFromParent = parent.get(Engine);
        var engineFromChild = child.get(Engine);

        expect(engineFromChild).toBe(engineFromParent);
      });

      it("should not use the child bindings when resolving the dependencies of a parent binding", function () {
        var parent = Injector.resolveAndCreate([
          Car, Engine
        ]);
        var child = parent.resolveAndCreateChild([
          bind(Engine).toClass(TurboEngine)
        ]);

        var carFromChild = child.get(Car);
        expect(carFromChild.engine).toBeAnInstanceOf(Engine);
      });

      it('should create new instance in a child injector', function () {
        var parent = Injector.resolveAndCreate([Engine]);
        var child = parent.resolveAndCreateChild([
          bind(Engine).toClass(TurboEngine)
        ]);

        var engineFromParent = parent.get(Engine);
        var engineFromChild = child.get(Engine);

        expect(engineFromParent).not.toBe(engineFromChild);
        expect(engineFromChild).toBeAnInstanceOf(TurboEngine);
      });

      it("should create child injectors without default bindings", function () {
        var parent = Injector.resolveAndCreate([], {defaultBindings: true});
        var child = parent.resolveAndCreateChild([]);

        //child delegates to parent the creation of Car
        var childCar = child.get(Car);
        var parentCar = parent.get(Car);

        expect(childCar).toBe(parentCar);
      });
    });

    describe("lazy", function () {
      it("should create dependencies lazily", function () {
        var injector = Injector.resolveAndCreate([
          Engine,
          CarWithLazyEngine
        ]);

        var car = injector.get(CarWithLazyEngine);
        expect(car.engineFactory()).toBeAnInstanceOf(Engine);
      });

      it("should cache instance created lazily", function () {
        var injector = Injector.resolveAndCreate([
          Engine,
          CarWithLazyEngine
        ]);

        var car = injector.get(CarWithLazyEngine);
        var e1 = car.engineFactory();
        var e2 = car.engineFactory();

        expect(e1).toBe(e2);
      });
    });

    describe('resolve', function() {
      it('should resolve and flatten', function() {
        var bindings = Injector.resolve([Engine, [BrokenEngine]]);
        bindings.forEach(function(b) {
          if (isBlank(b)) return;  // the result is a sparse array
          expect(b instanceof ResolvedBinding).toBe(true);
        });
      });
    });
  });
}

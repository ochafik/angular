import {bind, Provider, OpaqueToken} from 'angular2/src/core/di';
import {PromiseWrapper, TimerWrapper} from 'angular2/src/facade/async';
import {StringMapWrapper} from 'angular2/src/facade/collection';
import {isNumber} from 'angular2/src/facade/lang';
import {BaseException} from "angular2/src/facade/exceptions";

import {Metric} from '../metric';
import {WebDriverAdapter} from '../web_driver_adapter';

var _USER_PROPERTIES = new OpaqueToken('UserMetric.properties');

export class UserProperty {
  constructor(public name: string, public description: string) {}
}

export class UserMetric extends Metric {
  static createBindings(properties: {[key: string]: string}): Provider[] {
    return [
      bind(_USER_PROPERTIES)
          .toFactory(() => StringMapWrapper.keys(properties)
                               .map(propName => new UserProperty(propName, properties[propName]))),
      bind(UserMetric)
          .toFactory((properties, wdAdapter) => new UserMetric(properties, wdAdapter),
                     [_USER_PROPERTIES, WebDriverAdapter])
    ];
  }
  constructor(private _properties: UserProperty[], private _wdAdapter: WebDriverAdapter) {
    super();
  }

  /**
   * Starts measuring
   */
  beginMeasure(): Promise<any> { return PromiseWrapper.resolve(true); }

  /**
   * Ends measuring.
   */
  endMeasure(restart: boolean): Promise<{[key: string]: any}> {
    let completer = PromiseWrapper.completer<{[key: string]: any}>();
    let adapter = this._wdAdapter;
    let names = this._properties.map((prop) => prop.name);

    function getAndClearValues() {
      PromiseWrapper.all(names.map(name => adapter.executeScript(`return window.${name}`)))
          .then((values: any[]) => {
            if (values.every(isNumber)) {
              PromiseWrapper.all(names.map(name => adapter.executeScript(`delete window.${name}`)))
                  .then((_: any[]) => {
                    let map = StringMapWrapper.create();
                    for (let i = 0, n = names.length; i < n; i++) {
                      StringMapWrapper.set(map, names[i], values[i]);
                    }
                    completer.resolve(map);
                  }, completer.reject);
            } else {
              TimerWrapper.setTimeout(getAndClearValues, 100);
            }
          }, completer.reject);
    }
    getAndClearValues();
    return completer.promise;
  }

  /**
   * Describes the metrics provided by this metric implementation.
   * (e.g. units, ...)
   */
  describe(): {[key: string]: any} {
    var desc = {};
    for (let prop of this._properties) {
      desc[prop.name] = prop.description;
    }
    return desc;
  }
}

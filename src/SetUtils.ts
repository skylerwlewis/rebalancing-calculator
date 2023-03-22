import { Dispatch, SetStateAction } from 'react';

export function getNewValue<T>(value: SetStateAction<T>, prevValue: T): T {
  return value instanceof Function ? value(prevValue) : value;
}

export function setTransform<T>(setValue: Dispatch<SetStateAction<T>>, transform: (val: T) => T, untransform?: (val: T) => T): Dispatch<SetStateAction<T>> {
  return (value: SetStateAction<T>) =>
    setValue((prevState: T) => transform(getNewValue(value, !untransform ? prevState : untransform(prevState))));
}

export function setIf<T>(condition: (val: T) => boolean, setValue: Dispatch<SetStateAction<T>>): Dispatch<SetStateAction<T>> {
  return (value: SetStateAction<T>) =>
    setValue((prevState: T) => {
      const newState = getNewValue(value, prevState);
      if (condition(newState)) {
        return newState;
      } else {
        return prevState;
      }
    });
}

export function swap(valueSetters: Dispatch<SetStateAction<any[]>>[]): (index1: number, index2: number) => void {
  return (index1: number, index2: number) => {
    const lowerIndex = Math.min(index1, index2);
    const upperIndex = Math.max(index1, index2);
    const indicesEqual = (lowerIndex === upperIndex);
    for (const setValues of valueSetters) {
      setValues(values => [
        ...values.slice(0, lowerIndex),
        values[upperIndex],
        ...values.slice(lowerIndex + 1, upperIndex),
        ...(!indicesEqual ? [values[lowerIndex]] : []),
        ...values.slice(upperIndex + 1)
      ]);
    }
  };
}

export function setItemProperty<P, I>(
  itemIndex: number,
  getItemProperty: (item: I) => P,
  getUpdatedItem: (prevValue: I, newPropertyValue: P) => I,
  setItems: Dispatch<SetStateAction<I[]>>,
): Dispatch<SetStateAction<P>> {
  return (value: SetStateAction<P>) => {
    setItems(prevItems => {
      const newPropertyValue = getNewValue(value, getItemProperty(prevItems[itemIndex]));
      return [
        ...prevItems.slice(0, itemIndex),
        getUpdatedItem(prevItems[itemIndex], newPropertyValue),
        ...prevItems.slice(itemIndex + 1)
      ]
    });
  };
}

export function setGroupItemProperty<P, I, G>(
  itemIndex: number,
  itemGroupIndex: number,
  getItemProperty: (item: I) => P,
  getUpdatedGroup: (prevValue: G, newItems: I[]) => G,
  getUpdatedItem: (prevValue: I, newPropertyValue: P) => I,
  setItemGroups: Dispatch<SetStateAction<G[]>>,
  getItems: (group: G) => I[]
): Dispatch<SetStateAction<P>> {
  return (value: SetStateAction<P>) => {
    setItemGroups(prevItemGroups => {
      const newPropertyValue = getNewValue(value, getItemProperty(getItems(prevItemGroups[itemGroupIndex])[itemIndex]));
      return [
        ...prevItemGroups.slice(0, itemGroupIndex),
        getUpdatedGroup(prevItemGroups[itemGroupIndex], [
          ...getItems(prevItemGroups[itemGroupIndex]).slice(0, itemIndex),
          getUpdatedItem(getItems(prevItemGroups[itemGroupIndex])[itemIndex], newPropertyValue),
          ...getItems(prevItemGroups[itemGroupIndex]).slice(itemIndex + 1)
        ]),
        ...prevItemGroups.slice(itemGroupIndex + 1)
      ]
    });
  };
}

export function setItems<I, G>(
  itemGroupIndex: number,
  getUpdatedGroup: (prevValue: G, newItems: I[]) => G,
  setItemGroups: Dispatch<SetStateAction<G[]>>,
  getItems: (group: G) => I[]
): Dispatch<SetStateAction<I[]>> {
  return (value: SetStateAction<I[]>) => {
    setItemGroups(prevItemGroups => {
      const newItems = getNewValue(value, getItems(prevItemGroups[itemGroupIndex]));
      return [
        ...prevItemGroups.slice(0, itemGroupIndex),
        getUpdatedGroup(prevItemGroups[itemGroupIndex], newItems),
        ...prevItemGroups.slice(itemGroupIndex + 1)
      ]
    });
  };
}

export function removeGroupItem<I, G>(
  itemIndex: number,
  itemGroupIndex: number,
  getUpdatedGroup: (prevValue: G, newItems: I[]) => G,
  itemGroups: G[],
  getItems: (group: G) => I[]
): G[] {
  return [
    ...itemGroups.slice(0, itemGroupIndex),
    ...(
      getItems(itemGroups[itemGroupIndex]).length === 1 ? [] :
        [
          getUpdatedGroup(itemGroups[itemGroupIndex], [
            ...getItems(itemGroups[itemGroupIndex]).slice(0, itemIndex),
            ...getItems(itemGroups[itemGroupIndex]).slice(itemIndex + 1)
          ])
        ]
    ),
    ...itemGroups.slice(itemGroupIndex + 1)
  ];
}

export function removeItem<I>(
  itemIndex: number,
  items: I[]
): I[] {
  return [
    ...items.slice(0, itemIndex),
    ...items.slice(itemIndex + 1)
  ];
}
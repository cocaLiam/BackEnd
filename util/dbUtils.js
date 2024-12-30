const { checkProps, log } = require("./codeHelperUtils");

// 디바이스 단일 조회 함수
const findOneByField = async (targetTable, field, value) => {
  try {
    const query = {};
    query[field] = value;
    const result = await targetTable.findOne(query);
    if (!result) {
      throw new HttpError(
        `DB에 ${field} : ${value}가 없습니다. `, 404
      );
    }
    return result;
  } catch (error) {
    return false;
  }
};

// 비밀번호필드를 제외한 디바이스 단일 조회 함수
const findOneByFieldWithoutPassword = async (targetTable, field, value) => {
  try {
    const query = {};
    query[field] = value;
    const result = await targetTable.findOne(query, "-password");
    if (!result) {
      throw new HttpError(
        `DB에 ${field} : ${value}가 없습니다. `, 404
      );
    }
    return result;
  } catch (error) {
    return false;
    // throw new HttpError(`디바이스 조회 중 오류 발생:', ${error} `, 500);
  }
};

// 디바이스 복수 조회 함수
const findAllByField = async (targetTable, field, value) => {
  try {
    const query = {};
    query[field] = value;
    const result = await targetTable.find(query);
    if (!result) {
      throw new HttpError(
        `DB에 ${field} : ${value}가 없습니다. `, 404
      );
    }
    return result;  // 찾은 result 하나도 없으면 빈 [] 을 리턴
  } catch (error) {
    return false;
    // throw new HttpError(`디바이스 조회 중 오류 발생:', ${error} `, 500);
  }
};

// 디바이스 삭제 함수
const deleteByField = async (targetTable, field, value) => {
  try {
    const query = {};
    query[field] = value;
    const result = await targetTable.deleteOne(query);
    if (result.deletedCount === 0) {
      throw new HttpError(
        `DB에 ${field} : ${value}가 없습니다. `, 404
      );
    }
  } catch (error) {
    throw new HttpError(`디바이스 삭제 중 오류 발생:', ${error} `, 500);
  }
};

// 새 디바이스 생성 함수
const createCollection = async (targetTable, collection) => {
  try {
    const newTable = new targetTable(collection);
    const result = await newTable.save();
    return result;  // 저장된 문서를 반환
  } catch (error) {
    throw new HttpError(`디바이스 저장 중 오류 발생:', ${error} `, 500);
  }
};

// 디바이스 정보 업데이트 함수
const updateByField = async (targetTable, field, value, updateData) => {
  try {
    const query = {};
    query[field] = value;
    const updateTable = await targetTable.findOneAndUpdate(
      query,
      updateData,
      { new: true }
    );

    if (!updateTable) {
      throw new HttpError(
        `DB에 ${field} : ${value}가 없습니다. `, 404
      );
    }
    return updateTable;  // 업데이트된 문서를 반환
  } catch (error) {
    throw new HttpError(`디바이스 업데이트 중 오류 발생:', ${error} `, 500);
  }
};

exports.findOneByField = findOneByField
exports.findOneByFieldWithoutPassword = findOneByFieldWithoutPassword
exports.findAllByField = findAllByField
exports.deleteByField = deleteByField
exports.createCollection = createCollection
exports.updateByField = updateByField
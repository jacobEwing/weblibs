<?php
// This class is used for simplifying the handling of database records.  Any
// record can be retreived as an object, its values manipulated, etc.  Data is
// scrubbed in the dbRecord class to prevent SQL injections when it gets saved.
// tl;dr: It's a simple ORM of sorts

/*
I might have to actually start documenting this.

 Notes:
  - There is a restriction in field aliases:  You can't alias one field to be
    the actual name of another.  Well, you probably can, but it will have
    unexpected results.
    e.g.  if you have fields named 'foobar' and 'barfoo', you can't give
    'foobar' the alias 'barfoo'

  - the variable "maxlength" can now be defined for fields in the _fields
    array.  One special case is for VARCHAR fields, where you can explicitly
    define it that way, or you can define it in the SQL format VARCHAR(#).

  - The function 'getData' and any others that start with "set" or "get" should
    be renamed to avoid those prefixes.  As is, if a table has a field called
    "data", it will not work properly.

    There are quite a few of those.  Another solution would be to move away from
    $obj->get<field>()

    to simply:
    $obj-><field>()

    both of which are currently valid


 - TODO Would be nice to have a "getBy" function to find all records that match
   a specific field value.  

   e.g.
   	userClass::getBy('managerId', 1);
   or
   	userClass::getByManagerId(1);

   Would both return all users who have user 1 as their manager.
   That would need to be done in a way that doesn't break getting fields that
   start with "by".  e.g. "getBylaw" or "getByLaw".
*/
define('_DB_host', '<host name>');
define('_DB_database', '<database name>');
define('_DB_user', '<db username>');
define('_DB_password', '<db password>');

@$mysqli = new mysqli(_DB_host, _DB_user, _DB_password, _DB_database);
if($mysqli->connect_errno){
	throw new Exception("dbTemplate.php: db connect failed: " . $mysqli->connect_errno);
}

abstract class dbRecord{
	protected $_data;
	protected $_fields;
	protected $_keys;
	protected $_aliasMap;
	protected $_isNewRecord;
	protected $_mysqli;
	protected $_links;

	abstract protected function _initialize();

	public $settings;
	function __construct(){
		global $mysqli;
		$this->_mysqli = $mysqli;
		$this->_initialize();
		$this->_postInitialize();

		$this->reset();

		$numArgs = func_num_args();
		$numExpectedArgs = count($this->_keys);
		if($numArgs == $numExpectedArgs){
			$this->load(func_get_args());
		}else if($numArgs != 0){
			$errMsg = get_class($this) . " construct expects $numExpectedArgs parameter" . ($numExpectedArgs == 1 ? '' : 's');
			$errMsg .= " (" . implode(', ', $this->_keys);
			$errMsg .= "), received $numArgs instead";
			throw new Exception($errMsg);
		}
	}

	// massage the initialization specs, handling aliases, max string lengths
	private function _postInitialize(){
		foreach($this->_fields as &$field){
			if(preg_match('/^VARCHAR\(\d+\)/', strtoupper($field['type']))){
				$parts = preg_split('/[\(\)]/', $field['type']);
				$field['type'] = 'VARCHAR';
				$field['maxlength'] = intval($parts[1]);
			}
		}
		$this->_buildAliasMap();
	}

	// assemble our settings data in a publicly viewable array
	private function _buildSettings(){
		$this->settings = array();
		$this->settings['tableName'] = $this->_tableName;
		$this->settings['keys'] = $this->_keys;
		$this->settings['fields'] = $this->_fields;
		$this->settings['links'] = $this->_links;
	}

	// reset this record to a blank one
	public function reset(){
		foreach($this->_fields as $fName => $fData){
			$this->_data[$fName] = $fData['default'];
		}

		// scrub table links and define the array if it doesn't exists
		$newLinks = array();
		if(is_array($this->_links)){
			foreach($this->_links as $key => $val){
				$newLinks[strtolower(trim($key))] = $val;
			}
		}
		$this->_links = $newLinks;
		$this->_isNewRecord = true;
		$this->_buildSettings();
	}

	// delete this record from the database and reset the object
	public function delete(){

		if(method_exists($this, '_predelete')){
			$this->_predelete();
		}

		if(!$this->_isNewRecord){
			$query = "DELETE FROM `" . $this->_tableName . "` WHERE ";
			$queryParts = array();
			foreach($this->_keys as $keyField){
				$queryParts[] .= "`$keyField` = '" . $this->_data[$keyField] . "'";
			}
			$query .= implode(' AND ', $queryParts);
			if(!$this->_mysqli->query($query)){
				throw new Exception("Unable to delete record: {$this->_mysqli->error}\nFailed query: $query");
			}
		}
		$this->reset();
	}

	// build our map of aliases from the initial _fields data
	protected function _buildAliasMap(){
		$this->_aliasMap = array();
		foreach($this->_fields as $fName => $fData){
			if(array_key_exists('alias', $fData)){
				$this->_aliasMap[strtolower($fData['alias'])] = $fName;
			}else{
				$this->_aliasMap[strtolower($fName)] = $fName;
			}
		}
	}

	// scrub the data in this record
	protected function _scrubValue($value, $fieldName){
		$rval = null;
		$canBeNULL = true;
		if(array_key_exists('notnull', $this->_fields[$fieldName])){
			$canBeNULL = ($this->_fields[$fieldName]['notnull'] == false);
		}
		if($canBeNULL && $value === null){
			return $rval;
		}
		$fieldType = strtoupper($this->_fields[$fieldName]['type']);
		switch($fieldType){
			case 'INT': case 'INTEGER':
				$rval = intval($value);
				break;
			case 'DECIMAL':
				if(array_key_exists('rounding', $this->_fields[$fieldName])){
					$digits = intval($this->_fields[$fieldName]['rounding']);
					$rval = number_format(floatval($value), $digits);
				}else{
					$rval = floatval($value);
				}
				break;
			case 'FLOAT':
				$rval = floatval($value);
				break;
			case 'BOOLEAN':
				$rval = $value ? 1 : 0;
				break;
			case 'VARCHAR': case 'TEXT': case 'DATE': case 'TIME': case 'DATETIME': case 'TIMESTAMP':
				$rval = $this->_mysqli->real_escape_string($value);
				break;
			case 'ENUM':
				if(in_array($value, $this->_fields[$fieldName]['values'])){
					$rval = $this->_mysqli->real_escape_string($value);
				}
				break;
			default:
				$rval = $this->_mysqli->real_escape_string($value);
		}

		if(array_key_exists('unsigned', $this->_fields[$fieldName])){
			if(in_array($fieldType, array('INT', 'INTEGER', 'DECIMAL', 'FLOAT'))){
				$rval = abs($rval);
			}
		}

		return $rval;
	}

	// handle dynamic static functions like <class>::getBy<field>(<value>);
	public static function __callStatic($funcName, $args){
		$rval = null;
		if(strtolower(substr($funcName, 0, 5)) == 'getby'){
			$className = get_called_class();
			$obj = new $className();
			if(count($args) != 1){
				throw new Exception("dbTemplate::__callStatic<$funcName>: invalid argument count (" . count($args) . ")");
			}

			if(is_array($args[0])){
				$idList = $args[0];
			}else{
				$idList = array($args[0]);
			}

			$results = array();
			foreach($idList as $id){
				$val = $obj->getByField(substr($funcName, 5), $id);
				if($val != null){
					$results[] = $val;
				}
			}
			if(count($results) == 1){
				$rval = $results[0];
			}else if(count($results) > 1){
				$rval = $results;
			}
		}else{
			// Could also add a get<Field> and set<Field> function that updates one particualr
			// field on all records.  May not be that useful though.

			throw new Exception("dbRecord::$funcName is not defined.");
		}
		return $rval;
	}

	// find the record(s) that this one links to based on the links 
	public function linkedRecords($linkname){
		$conditions = array('TRUE');
		$definition = $this->_links[$linkname];
		foreach($definition['linkfields'] as $thisField => $thatField){
			$condition = '`' . $this->_mysqli->real_escape_string($thatField);
			$condition .= "` = '" . $this->_mysqli->real_escape_string($this->_data[$thisField]) . "'";
			$conditions[] = $condition;
		}
		$classSettings = $definition['class']::getSettings();
		$query = "SELECT * FROM `" . $classSettings['tableName'] . "` WHERE " . implode(' AND ', $conditions);
		$results = $this->_mysqli->query($query);

		// we won't put any count limit on the query, but instead
		// return an array of records of there's more than one
		if($results->num_rows == 0){
			$rval = null;
		}else if($results->num_rows == 1){
			$rval = new $definition['class']();
			$rval->setData($results->fetch_assoc(), array('noalias'));
			$rval->setNewRecord(false);
		}else if($results->num_rows > 1){
			$rval = array();
			while($row = $results->fetch_assoc()){
				$obj = new $definition['class']();
				$obj->setData($row, array('noalias'));
				$obj->setNewRecord(false);
				$rval[] = $obj;
			}
		}else{
			// shouldn't be possible, but just in case...
			throw new Exception('dbRecord::__call::default: weird result: num_rows = ' . $results->num_rows);
		}
		return $rval;
	}

	public function getField($name){
		$rval = null;

		// first, look for an aliased field name that matches $name:
		if(array_key_exists($name, $this->_aliasMap)){
			if(array_key_exists('gethandler', $this->_fields[$this->_aliasMap[$name]])){
				// fixme... This will not handle the case where "gethandler" points to
				// an undefined function.  It may give infinite recursion as a result.
				$rval = $this->{$this->_fields[$this->_aliasMap[$name]]['gethandler']}($params);
			}else{
				$rval = $this->_data[$this->_aliasMap[$name]];
			}

		// ok, let's see if we can find it as a raw field name
		}else if(array_key_exists($name, $this->_fields)){
			if(array_key_exists('gethandler', $this->_fields[$name])){
				$rval = $this->{$this->_fields[$name]['gethandler']}();
			}else{
				$rval = $this->_data[$name];
			}

		// maybe we can find it as a linked record		
		}else if(array_key_exists($name, $this->_links)){
			$rval = $this->linkedRecords($name);

		// no dice
		}else{
			throw new Exception(get_class($this) . "::getField(): Invalid field name \"$name\"");
		}

		return $rval;
	}

	// handle various calls that use the field names (e.g. getId(), setId(), etc.)
	public function __call($functionName, $params){
		$func = strtolower(trim($functionName));

		// if this exists in our _links array, then find the corresponding record(s).
		if(array_key_exists($func, $this->_links)){
			return $this->linkedRecords($func);

		}else{
			$prefix = substr($func, 0, 3);
			if($prefix == 'get'){
				$name = substr($func, 3);
				return $this->getField($name);
			
			}else if($prefix == 'set'){
				$name = substr($func, 3);
				$thisField = null;
				if(array_key_exists($name, $this->_aliasMap)){
					$thisField = $this->_aliasMap[$name];
				}else if(array_key_exists($name, $this->_fields)){
					$thisField = $name;
				}
				if($thisField != null){
					if(count($params) != 1){
						throw new Exception("function " . get_class($this) . "::set$name expects a single value parameter");
					}

					// call the custom validator if defined.  It's expected to throw an exception if the field value is invalid
					if(array_key_exists('validator', $this->_fields[$thisField])){
						$this->{$this->_fields[$thisField]['validator']}($params[0]);
					}
					// if a custom scrubber is defined, it should return a clean version of data passed in
					if(array_key_exists('scrubber', $this->_fields[$thisField])){
						$params[0] = $this->{$this->_fields[$thisField]['scrubber']}($params[0]);
					}


					// if a custom function for handling a set on this variable is defined, then call it
					if(array_key_exists('sethandler', $this->_fields[$thisField])){
						// fixme... This will not handle the case where "sethandler" points to
						// an undefined function.  It may give infinite recursion as a result.
						return $this->{$this->_fields[$thisField]['sethandler']}($params[0]);
					}else{
						// validate ENUMS
						if($this->_fields[$thisField]['type'] == 'enum'){
							if(!in_array($params[0], $this->_fields[$thisField]['values'])){
								throw new Exception("field $name is an ENUM and expects one of the following values: " . implode(', ', $this->_fields[$thisField]['values']));
							}
						}

						// validate integer fields
						if(in_array($this->_fields[$thisField]['type'], array('INT', 'INTEGER'))){
							if(!preg_match('/^[0-9+-]*$/', $params[0])){
								throw new Exception("field $name expects an integer value");
							}
						}

						// validate VARCHAR with a defined length
						if(array_key_exists('maxlength', $this->_fields[$thisField])){
							if(strlen($params[0]) > $this->_fields[$thisField]['maxlength']){
								throw new Exception("value '{$params[0]}' exceeds maximum field length of " . $this->_fields[$thisField]['maxlength']);
							}
						}

						// hey!  If we made it this far, then the value seems valid and we can store it
						$this->_data[$thisField] = $params[0];
						return $params[0];
					}
				}else if(array_key_exists($name, $this->_links)){
					if(count($params) != 1){
						throw new Exception("dbRecord::$functionName: expecting one parameter of dbRecord type.  Received " . count($params) . " objects");
					}

					$objType = gettype($params[0]);
					if($objType != 'object'){
						throw new Exception("dbRecord::$functionName: expecting record of class '" . $this->_links[$name]['class'] . "', instead received one of type $objType");
					}
					$objClass = get_class($params[0]);
					if($objClass != $this->_links[$name]['class']){
						throw new Exception("dbRecord::$functionName: expecting record of class '" . $this->_links[$name]['class'] . "', instead received one of type $objClass");
					}

					// no exception?  Ok, we can assign the necessary link fields.
					foreach($this->_links[$name]['linkfields'] as $myField => $theirField){
						$this->_data[$myField] = $params[0]->{'get' . $theirField}();
					}
				}else{
					throw new Exception(get_class($this) . "::set$name: Invalid field name \"$name\"");
				}
			}else{
				throw new Exception("dbTemplate::__call: call to non-existant member function: " . $functionName);
			}
		}
	}

	// make the object's string value a json object string
	function __tostring(){
		return json_encode($this->getData(true));
	}

	// save the record, and update accordingly if it's a newly created one.
	public function save(){
		if($this->_isNewRecord){
			// we're creating a new record
			$query = "INSERT INTO `" . $this->_mysqli->real_escape_string($this->_tableName) . "`";
			$fieldList = array();
			$valueList = array();
			foreach($this->_fields as $fName => $fStruct){
				// if it's not an auto-increment or the value is not the default for this field, then we insert this field
				if(!array_key_exists('auto', $fStruct) || $this->_data[$fName] != $fStruct['default']){
					$fieldList[] = $this->_mysqli->real_escape_string($fName);
					$val = $this->_scrubValue($this->_data[$fName], $fName);
					if($val === null){
						$valueList[] = 'NULL';
					}else{
						$valueList[] = "'$val'";
					}
				}
			}
			$query .= " (`" . implode('`, `', $fieldList) . "`)";
			$query .= " VALUES (" . implode(", ", $valueList) . ")";
			if(!$this->_mysqli->query($query)){
				throw new Exception("Unable to create new record: " . $this->_mysqli->error . "\n" . $query . "\n");
			}

			// reload to pick up auto-increments, NOW(), and other automatic field values
			$this->_isNewRecord = false;

			foreach($this->_fields as $fName => $fStruct){
				if(array_key_exists('auto', $fStruct) && $fStruct['auto'] == true){
					$this->_data[$fName] = $this->_mysqli->insert_id;
				}
			}

			$this->refresh();
		}else{
			// we're updating an existing record
			$query = "UPDATE " . $this->_mysqli->real_escape_string($this->_tableName) . " SET ";
			$queryParts = array();
			foreach($this->_fields as $fName => $fStruct){
				// if it's not an auto-increment or the value is not the default for this field, then we insert this field
				if(!array_key_exists('auto', $fStruct) || $this->_data[$fName] != $fStruct['default']){
					$val = $this->_scrubValue($this->_data[$fName], $fName);
					if($val === null){
						$queryParts[] = "`$fName` = NULL";
					}else{
						$queryParts[] = "`$fName` = '" . $this->_scrubValue($this->_data[$fName], $fName) . "'";
					}
				}
			}
			$query .= implode(', ', $queryParts);

			$query .= " WHERE ";
			$queryParts = array();
			foreach($this->_keys as $keyField){
				$queryParts[] .= "`$keyField` = '" . $this->_scrubValue($this->_data[$keyField], $keyField) . "'";
			}
			$query .= implode(', ', $queryParts);
			if(!$this->_mysqli->query($query)){
				throw new Exception("Unable to update record: " . $this->_mysqli->error);
			}
		}
	}

	// refresh the field values in this record.  Used after a call to save() on a
	// new record so that automatic fields (e.g. TIMESTAMP NOW()), can be loaded
	// back into the object.
	public function refresh(){
		if($this->_isNewRecord) return;
		$keyVals = array();
		for($n = 0; $n < count($this->_keys); $n++){
			$keyVals[$n] = $this->_data[$this->_keys[$n]];
		}
		$this->load($keyVals);
	}

	// load a record using its primary keys
	public function load($keyVals){
		if(!is_array($keyVals)) $keyVals = array($keyVals);
		$conditions = array();

		for($n = 0; $n < count($this->_keys); $n++){
			$conditions[] = "`" . $this->_mysqli->real_escape_string($this->_keys[$n]) . "` = '" . $this->_scrubValue($keyVals[$n], $this->_keys[$n]) . "'";
		}
		$query = "SELECT * FROM `" . $this->_tableName . "` WHERE " . implode(' AND ', $conditions);
		$result = $this->_mysqli->query($query);
		$row = $result->fetch_assoc();
		if($row){
			$this->_isNewRecord = false;
			foreach($this->_fields as $fName => $fData){
				$this->_data[$fName] = $row[$fName];
			}
		}else{
			$this->reset();
			throw new Exception("dbTemplate::load: Invalid " . implode(', ', $this->_keys) . " value" . (count($this->_keys) > 1 ? 's' : ''));
		}
		if($row != null){
			$this->_buildSettings();
			return true;
		}else{
			return false;
		}
	}

	// assign values to a list of fields in this record, passed in as an array.
	// expects an array matching the field names in the format fieldname => value
	// does not require all fields, but will throw an exception if an invalid one is passed in.
	public function setData($data, $params = array()){
		$noAlias = in_array('noalias', $params);
		$ignoreError = in_array('noerror', $params);
		foreach($data as $field => $value){
			if($noAlias){
				if(!array_key_exists($field, $this->_fields)){
					throw new Exception('dbRecord::setData: Invalid field name "' . $field . '".');
				}
				$functionName = "set" . $this->getAlias($field);
			}else{
				$field = trim(strtolower($field));
				if(!array_key_exists($field, $this->_aliasMap)){
					throw new Exception('dbRecord::setData: Invalid field alias "' . $field . '".');
				}
				$functionName = "set" . $field;
			}

			try{
				$this->$functionName($value);
			}catch(Exception $e){
				// oh well.
				if(!$ignoreError){
					throw $e;
				}
			}
		}
	}

	// retrieve an array listing field aliases with their data values
	public function getData($noAlias = false){
		$rval = array();
		foreach($this->_aliasMap as $alias => $fieldName){
			$rval[$noAlias ? $fieldName : $alias] = $this->_data[$fieldName];
		}
		return $rval;
	}

	/* FIXME - these next two functions should be migrated to values in the $settings array */
	// get the table name
	public function getTableName(){
		return $this->_tableName;
	}

	// get the record status
	public function isNewRecord(){
		return $this->_isNewRecord;
	}

	// set the record status
	public function setNewRecord($bool){
		$this->_isNewRecord = $bool ? true : false;
	}

	// get the alias used for a specified db table field.  returns the
	// actual field string if no alias is in use.
	public function getAlias($fieldName){
		if(!array_key_exists($fieldName, $this->_fields)){
			throw new Exception("Invalid field name " . $fieldName . ".");
		}
		if(array_key_exists('alias', $this->_fields[$fieldName])){
			return $this->_fields[$fieldName]['alias'];
		}else{
			return $fieldName;
		}
	}

	// returns a nested array listing off all of the field information and values for this object.
	public function getArray(){
		$rval = array();
		foreach($this->_fields as $fName => $fStruct){
			$rval[$fName] = $fStruct;
			$rval[$fName]['value'] = $this->_data[$fName];
		}
		return $rval;
	}

	/**
	this is a bit of a hackey workaround:  I want to be able to do a search from an
	extension of this class, but I need to do it from an object of the extension in
	order to have the field names.  Hence creating an object of the called class
	here, and having that object do the work.
	**/
	// --------------------------------------------------
	// find all records that contain a field which matches the specified string
	public static function search($str = ''){
		$className = get_called_class();
		$temp = new $className();
		return $temp->_search($str);
	}

	// do the above called search as an object with all of the database info
	public function _search($str = ''){
		$query = "SELECT * FROM `" . $this->_tableName . "` WHERE ";
		$conditions = array('0');
		foreach($this->_aliasMap as $alias => $fieldName){
			$conditions[] = "`" . $this->_mysqli->real_escape_string($fieldName) .
					"` LIKE '%" . $this->_mysqli->real_escape_string($str) . "%'";
		}
		$query .= implode(' OR ', $conditions);
		$result = $this->_mysqli->query($query);
		$className = get_class($this);
		$rval = array();
		while($row = $result->fetch_assoc()){
			$record = new $className();
			$record->setData($row, array('noalias'));
			$rval[] = $record;
		}
		return $rval;
	}

	// --------------------------------------------------
	// returns an array of the field names in the record, aliased by default
	// unaliased if nonzero argument passed in
	public static function getFieldNames($unaliased = 0){
		$className = get_called_class();
		$temp = new $className();
		return $temp->_get_field_names($unaliased);
	}

	public function _get_field_names($unaliased = 0){
		$rval = array();
		foreach($this->_aliasMap as $alias => $field){
			$rval[] = $unaliased ? $field : $alias;
		}
		return $rval;
	}

	// --------------------------------------------------
	// retrieveAll returns an array of objects representing each record in the
	// table.
	public static function retrieveAll(){
		$className = get_called_class();
		$temp = new $className();
		return $temp->_retrieve_all_records();
	}

	public function _retrieve_all_records(){
		// manually build the records instead of callling the dbRecord construct to build them.
		// This is done to optimize speed.
		$className = get_called_class();
		$q = $this->_mysqli->query("SELECT * FROM `" . $this->_tableName . "`");

		$rval = [];
		while($row = $q->fetch_assoc()){			
			$obj = new $className();

			$obj->setData($row, array('noalias', 'noerror'));
			$obj->setNewRecord(false);
			$rval[] = $obj;
		}
		return $rval;
	}

	// --------------------------------------------------
	// verify whether or not the specified field name is valid within this
	// class
	public static function hasField($fieldName){
		$className = get_called_class();
		$temp = new $className();
		return $temp->_has_field($fieldName);
	}

	public function _has_field($fieldName){
		return in_array($fieldName, $this->_aliasMap) || array_key_exists($fieldName, $this->_aliasMap);
	}


	// --------------------------------------------------
	// retrieve private settings available
	public static function getSettings(){
		$className = get_called_class();
		$temp = new $className();
		return $temp->getObjectSettings();
	}

	public function getObjectSettings(){
		return $this->settings;
	}

	// --------------------------------------------------
	// retrieve record(s) by matching the specified value in the specified
	// field.  This is called by the __callStatic function defined above,
	// and is expected to be used in this fashion:
	//   $blah = foo::getByBar('snoo');
	// where 'foo' is the class being used, 'Bar' is the field being
	// searched, and 'snoo' is the value sought.
	//
	// it could also be done by:
	//   $blip = new foo();
	//   $blah = $blip->getByField('bar', 'snoo');
	// but that makes less sense semantically.

	public function getByField($fieldName, $value){
		// TODO: expand this to handle links as well, so I could say something like:
		// productClass::getBySupplier($supplierObject);
		// and expect a list of product objects linked to that supplier object.
		// ** maybe that's overkill though.  The above example would be equivalent to:
		// $supplierObject->getProducts();
		// or:
		// productClass::getBySupplierId($supplierObject->getId());

		$fieldName = strtolower(trim($fieldName));
		if(array_key_exists($fieldName, $this->_aliasMap)){
			$realFieldName = $this->_aliasMap[$fieldName];
		}else if(in_array($fieldName, $this->_aliasMap)){
			$realFieldName = $fieldName;
		}else{
			throw new Exception("dbTemplate::getByField('$fieldName', '$value'): Invalid field name '" . $fieldName . "'");
		}

		$query = "
			SELECT * FROM `" . $this->_tableName . "`
			WHERE `" . $this->_mysqli->real_escape_string($realFieldName) . "` = '"
			. $this->_scrubValue($value, $realFieldName) . "'
		";
		$results = $this->_mysqli->query($query);
		if(!$results){
			throw new Exception("dbTemplate::getByField('$fieldName', '$value'): " . $this->_mysqli->error);
		}

		// we won't put any count limit on the query, but instead
		// return an array of records of there's more than one
		$className = get_class($this);
		if($results->num_rows == 0){
			$rval = null;
		}else if($results->num_rows == 1){
			$rval = new $className();
			$rval->setData($results->fetch_assoc(), array('noalias'));
			$rval->setNewRecord(false);
		}else if($results->num_rows > 1){
			$rval = array();
			while($row = $results->fetch_assoc()){
				$obj = new $className();
				$obj->setData($row, array('noalias'));
				$obj->setNewRecord(false);
				$rval[] = $obj;
			}
		}else{
			// shouldn't be possible, but just in case...
			throw new Exception('dbRecord::__call::default: weird result: num_rows = ' . $results->num_rows);
		}
		return $rval;
	}
}

/** an example table usage **/
/*
class example extends dbRecord{
        protected function _initialize(){
		// the actual name of the database table
                $this->_tableName = 'users';

		// the names of the key fields in the table.  If you have multiple keys (e.g. a
		// link table), then they must all included in the _keys array.
                $this->_keys = array('id');

		// an array defining the fields in the table, with the keys being the database
		// field names, and the values being arrays of parameters. The only mandatory
		// parameter is "type", defining the datatype for each field.
                $this->_fields = array(
                        'id' => array(
                                'type' => 'INTEGER', // the data type of this field
                                'default' => 0, // the default value that should be assigned to this field
                                'auto' => true // flags this field as auto-generated by the database
                        ),
			'parent_id' => array(
				'type' => 'INTEGER',
				'unsigned' => true, // forces positive numbers if it evaluates to true
				'alias' => 'parentid' // an alias by which this field is referred to.  e.g. $foo->parentId = 1;
			),
			'example_field_1' => array(
				'type' => VARCHAR(24), // the (24) is optional.  Without it, no limit will be enforced
				'default' => null, // a null default value will be set to NULL on the database.
				'notnull' => true, // if 'notnull' evaluates to a boolean true, then null values can't be assigned
				'maxlength' => 24, // another way of handling the length restriction, instead of using the (24) above
				'alias' => 'myExample', // an alias by which this field can be referred to within the code (e.g $foo->myExample = 'bar';)
				'validator' => '_validate_examplefield', // a local function that tests whether the field value is valid or not.  Returns true if it's valid, false otherwise.
				'scrubber' => '_scrub_examplefield', // a local function that scrubs the assigned value when it's set.  Should return the scrubbed value.
			),
			'example_field_2' => array(
				'type' => 'DECIMAL',
				'rounding' => 2, // the number of digits to which the number should be rounded
				'default' => 2.72 // the default field that should be set on the record.  Does not have to match the database default.
			)
                );

		// Note that links can point to multiple records if needed.  If the link
		// conditions only match one record, then that record will be returned.  If it
		// matches multilpe records, then they will be returned in an array.  If no
		// records match, null is returned.
		$this->_links = array(
			'parent' => array(
				'class' => 'example',  // <-- the class of dbRecord extension that this link points to
				'linkfields' => array( // <-- an array of fields linking this record to the linked one
					'parent_id' => 'id' // <-- i.e. "this record's 'parent_id' field should match 'id' on the linked record(s)"
				)
			)
		);
        }

	// an example scrubber function
	public function _scrub_examplefield($val){
		return trim(strtolower($val));
	}

	// an example validator function
	public function _validate_examplefield($val){
		return strtolower(substr(trim($val), 0, 3)) == 'foo';
	}
}

// ************ Usage **********
// Here are some example uses and results using the above example class
// *****************************

// create a new record:
$foo = new example();

// load an existing record by passing the value of the key field values.:
$foo = new example(1);

// note that if the record has multiple fields for its primary key, you must pass those in:
$bar = new otherExample(1, 2);


// set values in the record:
$foo->setParentId(2);
$foo->setMyExample('foo: How much wood would a woodchuck chuck?');  // <- an exception is thrown in this example, as we specified the maximum field length of 24 characters.
$foo->setMyExample('alpha bravo'); // <-- the "_validate_examplefield" throws an exception
$foo->setMyExample('foobar 123');  // <-- successfully sets the value
$foo->setMyExample(' FOOBAR  '); // <-- successfully sets, the value, but the scrubber first changes it to "foobar"

// assign the specified values to the field whose aliases are the array keys.
$foo->setData(array('parentid' => 2, 'myexample' => 'snoo'));

// Same thing below.  The optional array of parameters are:
//    noalias: 
//	refer tho the actual field names, rather than their aliases
//    noerror: 
//	catch any errors thrown when trying to set the value.  Note that errors
//	for invalid field names will still be thrown.
$foo->setData(array('parent_id' => 2, 'example_field_1' => 'snoo'), array('noalias', 'noerror')); 

// retrieve an array of the data in the record:
// get an array with field aliases as the indeces, and the field values as the array values.
$bar = $foo->getData();
// get an array with unaliased field names as the indeces, and the field values as the array values.
$bar = $foo->getData(true);

// get an array listing off field values, structure and other data:
$details = $foo->getArray(); // * this should probably be renamed in the future

// geting values in the record:
$foo->id();
$foo->getId();

// following links:
$foo->parent();
$foo->getParent();
$foo->linkedRecords('parent');

// Note that these are all case insensitive, so $foo->GeTpArEnT() and $foo->SETmyEXAPLE('blah') are bothe valid.


// save the record:
$foo->save();


// refresh the record data, reloading it from the database:
$foo->refresh();

// get the name of the record's table:
$tableName = $foo->getTableName();

// find out if this record is a newly created one or if it is saved
if($foo->isNewRecord()){
	echo "This is a new record\n";
}

// get the alias of a specific field name:
$foo->getAlias('parent_id'); // <-- returns "parent_id"

// manually flag whether or not this record is new.  It is important to note
// that if a record is indeed new and you pass in a false value, then there
// will probably be complications when saving, especially with auto-increment
// field values.
$foo->setNewRecord(false);

// delete the record:
$foo->delete();


//////////////  some static functions for generic table usage: /////////////

// get an array of the aliased field names in the table:
example::getFieldNames();

// same, but with the actual field names rather than any aliases
example::getFieldNames(1);

// get all records in the tables:
example::retrieveAll();

// get an array of all record objects that contain a field matching a specified string
example::search('foo'); // <-- all records where any field contains the string "foo"

// get an arary of the class settings:
example::getSettings();

/* 
			
			future development:  add handling of link tables here.  Perhaps:
			'glAccounts' => array(
				'class' => 'GLALineItemsLink',
				'linkfields' => array(
					'id' => 'line_items_id'
				),
				'child' => array(
					'class' => 'glaClass',
					'linkfields' => array(
						'GL_accounts_id' => 'id'
					)
				)
			)

			An advantage with doing it that way would be that they could nest repeatedly.  e.g.
			'periods' => array(
				'class' => 'GLALineItemsLink',
				'linkfields' => array(
					'id' => 'line_items_id'
				),
				'child' => array(
					'class' => 'glaClass',
					'linkfields' => array(
						'GL_accounts_id' => 'id'
					),
					'child' => array(
						'class' => 'periodClass',
						'linkfields => array(
							'periods_id' => 'id'
						)
					)
				)
			)
*/
